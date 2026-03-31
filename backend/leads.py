import csv
import io
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import case
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .enrichment import enrich_and_score_lead
from .models import ConsultantProfile, Lead, User
from .schemas import (LeadCreate, LeadImportResponse, LeadOut, LeadUpdate,
                      ReanalyzeRequest)

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _get_profile(user_id: int, db: Session) -> ConsultantProfile | None:
    return db.query(ConsultantProfile).filter(ConsultantProfile.user_id == user_id).first()


def _get_lead(user_id: int, lead_id: int, db: Session) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.user_id == user_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.post("", response_model=LeadOut)
def create_lead(
    lead_in: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = Lead(
        user_id=current_user.id,
        company_name=lead_in.company_name,
        company_website=lead_in.company_website,
        contact_name=lead_in.contact_name,
        contact_role=lead_in.contact_role,
        notes=lead_in.notes,
        status="Identified",
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

    return lead


@router.get("", response_model=List[LeadOut])
def list_leads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    score_order = case(
        (
            (Lead.fit_score == "High", 1),
            (Lead.fit_score == "Medium", 2),
            (Lead.fit_score == "Low", 3),
        ),
        else_=4,
    )
    leads = (
        db.query(Lead)
        .filter(Lead.user_id == current_user.id)
        .order_by(score_order, Lead.created_at.desc())
        .all()
    )
    return leads


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_lead(current_user.id, lead_id, db)


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    updates: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, lead_id, db)
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, lead_id, db)
    db.delete(lead)
    db.commit()
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
    profile = _get_profile(current_user.id, db)
    imported = 0
    processed = 0

    for row in reader:
        processed += 1
        if not row.get("company_name"):
            continue
        lead = Lead(
            user_id=current_user.id,
            company_name=row.get("company_name", "").strip(),
            company_website=row.get("company_website", "").strip() or None,
            contact_name=row.get("contact_name", "").strip() or None,
            contact_role=row.get("contact_role", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
            status="Identified",
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
