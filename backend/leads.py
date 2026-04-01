import csv
import io
import math
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import case
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from .auth import get_current_user
from .database import get_db
from .enrichment import enrich_and_score_lead
from .feature_limits import check_limit, get_limits_for_tier
from .models import ConsultantProfile, Lead, User
from .schemas import (LeadCreate, LeadImportResponse, LeadOut,
                      LeadUpdate, PaginatedLeadResponse, ReanalyzeRequest)

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _get_profile(user_id: int, db: Session) -> ConsultantProfile | None:
    try:
        return db.query(ConsultantProfile).filter(ConsultantProfile.user_id == user_id).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")


def _get_lead(user_id: int, lead_id: int, db: Session) -> Lead:
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id, Lead.user_id == user_id).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.post("", response_model=LeadOut)
def create_lead(
    lead_in: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        existing_lead_count = db.query(Lead).filter(Lead.user_id == current_user.id).count()
        check_limit(current_user, "max_leads", existing_lead_count)

        lead = Lead(
            user_id=current_user.id,
            company_name=lead_in.company_name,
            company_website=lead_in.company_website,
            contact_name=lead_in.contact_name,
            contact_role=lead_in.contact_role,
            notes=lead_in.notes,
            status="Identified",
            pipeline_stage="Identified",
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)

        profile = _get_profile(current_user.id, db)
        if profile:
            enrich_and_score_lead(lead, profile, db)
        else:
            lead.fit_score = "Unable to analyze"
            lead.signal_justification = "Consultant profile is required for enrichment."
            lead.enrichment_data = {"error": "Consultant profile missing"}
            db.add(lead)
            db.commit()
            db.refresh(lead)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")

    return lead


@router.get("", response_model=PaginatedLeadResponse)
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    score_order = case(
        (Lead.fit_score == "High", 1),
        (Lead.fit_score == "Medium", 2),
        (Lead.fit_score == "Low", 3),
        else_=4,
    )
    try:
        query = (
            db.query(Lead)
            .options(selectinload(Lead.outreach_messages))
            .filter(Lead.user_id == current_user.id)
            .order_by(score_order, Lead.created_at.desc())
        )
        total = query.count()
        leads = query.offset((page - 1) * page_size).limit(page_size).all()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    for lead in leads:
        lead.outreach_count = len(lead.outreach_messages)
        lead.proposal_count = len(lead.proposals)
    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": leads,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, lead_id, db)
    lead.outreach_count = len(lead.outreach_messages)
    lead.proposal_count = len(lead.proposals)
    return lead


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    updates: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, lead_id, db)
    try:
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(lead, field, value)
        db.add(lead)
        db.commit()
        db.refresh(lead)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return lead


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, lead_id, db)
    try:
        db.delete(lead)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return {"detail": "Lead deleted"}


@router.post("/import", response_model=LeadImportResponse)
def import_leads(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV uploads are allowed.")

    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    rows = [row for row in reader if row.get("company_name")]
    profile = _get_profile(current_user.id, db)
    imported = 0
    processed = len(rows)

    limits = get_limits_for_tier(current_user.subscription_tier)
    if not limits["can_import_csv"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your current plan does not allow CSV import. Upgrade to import leads.")

    try:
        existing_lead_count = db.query(Lead).filter(Lead.user_id == current_user.id).count()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    available_space = limits["max_leads"] - existing_lead_count
    if available_space <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You have reached the {limits['max_leads']} lead limit on the {current_user.subscription_tier} plan. Upgrade to add more leads.",
        )
    if processed > available_space:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Import would exceed your lead limit by {processed - available_space} leads. Upgrade to import more leads.",
        )

    try:
        for row in rows:
            lead = Lead(
                user_id=current_user.id,
                company_name=row.get("company_name", "").strip(),
                company_website=row.get("company_website", "").strip() or None,
                contact_name=row.get("contact_name", "").strip() or None,
                contact_role=row.get("contact_role", "").strip() or None,
                notes=row.get("notes", "").strip() or None,
                status="Identified",
                pipeline_stage="Identified",
            )
            db.add(lead)
            db.commit()
            db.refresh(lead)
            if profile:
                enrich_and_score_lead(lead, profile, db)
            else:
                lead.fit_score = "Unable to analyze"
                lead.signal_justification = "Consultant profile is required for enrichment."
                lead.enrichment_data = {"error": "Consultant profile missing"}
                db.add(lead)
                db.commit()
                db.refresh(lead)
            imported += 1
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")

    return LeadImportResponse(imported=imported, processed=processed)


@router.post("/{lead_id}", response_model=LeadOut)
def reanalyze_lead(
    lead_id: int,
    payload: ReanalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, lead_id, db)
    if not payload.re_analyze:
        return lead

    profile = _get_profile(current_user.id, db)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consultant profile is required to run re-analysis.",
        )
    enrich_and_score_lead(lead, profile, db)
    return lead
