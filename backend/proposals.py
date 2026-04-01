import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from .auth import get_current_user
from .database import get_db
from .feature_limits import check_limit
from .emails import send_proposal_sent_notification
from .models import ConsultantProfile, Lead, PipelineEvent, Proposal, User
from .proposal_prompts import proposal_prompt, sow_prompt
from .schemas import (
    ProposalGenerateRequest,
    ProposalOut,
    ProposalUpdate,
)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is required in the backend .env file")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

router = APIRouter(prefix="/api/proposals", tags=["proposals"])

template_dir = os.path.join(os.path.dirname(__file__), "templates")
env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(["html", "xml"]),
)

VALID_PROPOSAL_TYPES = {"proposal", "sow"}
VALID_RATE_TYPES = {"hourly", "project"}
VALID_STATUS = {"Draft", "Sent", "Viewed", "Accepted", "Declined"}


def _parse_claude_response(completion_text: str) -> dict:
    trimmed = completion_text.strip()
    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Failed to parse Claude JSON response")
    return json.loads(trimmed[start:end + 1])


def _get_profile(user_id: int, db: Session) -> Optional[ConsultantProfile]:
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


def _get_proposal(user_id: int, proposal_id: int, db: Session) -> Proposal:
    try:
        proposal = (
            db.query(Proposal)
            .options(selectinload(Proposal.lead))
            .filter(Proposal.id == proposal_id, Proposal.user_id == user_id)
            .first()
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    return proposal


def _decorate_proposal(proposal: Proposal) -> Proposal:
    if proposal.lead:
        setattr(proposal, "company_name", proposal.lead.company_name)
        setattr(proposal, "contact_name", proposal.lead.contact_name)
        setattr(proposal, "contact_role", proposal.lead.contact_role)
    return proposal


def _generate_proposal(
    profile: ConsultantProfile,
    lead: Lead,
    payload: ProposalGenerateRequest,
) -> dict:
    if payload.proposal_type == "proposal":
        prompt = proposal_prompt(
            profile,
            lead,
            payload.scope_notes,
            payload.timeline_preference,
            payload.rate_type,
            payload.rate_amount,
            payload.currency,
        )
    else:
        prompt = sow_prompt(
            profile,
            lead,
            payload.scope_notes,
            payload.timeline_preference,
            payload.rate_type,
            payload.rate_amount,
            payload.currency,
        )

    try:
        response = client.completions.create(
            model="claude-3.5",
            prompt=prompt,
            max_tokens_to_sample=800,
            temperature=0.2,
            stop_sequences=["\n\n"],
            timeout=30.0,
        )
    except anthropic.APITimeoutError:
        raise HTTPException(status_code=504, detail="AI generation timed out — please try again.")
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return _parse_claude_response(response.completion)


def _create_proposal(current_user: User, lead: Lead, data: dict, payload: ProposalGenerateRequest, db: Session) -> Proposal:
    pricing_table = data.get("pricing_table") or []
    total_price = data.get("total_price") or 0.0
    proposal = Proposal(
        user_id=current_user.id,
        lead_id=lead.id,
        version=1,
        proposal_type=payload.proposal_type,
        title=data.get("title", "Proposal"),
        executive_summary=data.get("executive_summary", ""),
        problem_statement=data.get("problem_statement", ""),
        proposed_approach=data.get("proposed_approach") or [],
        timeline=data.get("timeline", ""),
        pricing_table=pricing_table,
        total_price=total_price,
        currency=payload.currency,
        status="Draft",
        notes="",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    try:
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return _decorate_proposal(proposal)


@router.post("/generate", response_model=ProposalOut)
def generate_proposal(
    payload: ProposalGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.proposal_type not in VALID_PROPOSAL_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid proposal type.")
    if payload.rate_type not in VALID_RATE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rate type.")

    lead = _get_lead(current_user.id, payload.lead_id, db)
    profile = _get_profile(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consultant profile is required for proposal generation.")

    try:
        existing_proposal_count = db.query(Proposal).filter(Proposal.user_id == current_user.id).count()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    check_limit(current_user, "max_proposals", existing_proposal_count)

    result = _generate_proposal(profile, lead, payload)
    return _create_proposal(current_user, lead, result, payload, db)


@router.get("", response_model=List[ProposalOut])
def list_proposals(
    lead_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Proposal)
        .options(selectinload(Proposal.lead))
        .filter(Proposal.user_id == current_user.id)
        .order_by(Proposal.updated_at.desc())
    )
    if lead_id is not None:
        query = query.filter(Proposal.lead_id == lead_id)
    try:
        proposals = query.all()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return [_decorate_proposal(proposal) for proposal in proposals]


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _decorate_proposal(_get_proposal(current_user.id, proposal_id, db))


@router.put("/{proposal_id}", response_model=ProposalOut)
def update_proposal(
    proposal_id: int,
    updates: ProposalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = _get_proposal(current_user.id, proposal_id, db)
    try:
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(proposal, field, value)
        proposal.version += 1
        proposal.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(proposal)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return _decorate_proposal(proposal)


@router.delete("/{proposal_id}")
def delete_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = _get_proposal(current_user.id, proposal_id, db)
    try:
        db.delete(proposal)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return {"detail": "Proposal deleted"}


@router.post("/{proposal_id}/duplicate", response_model=ProposalOut)
def duplicate_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = _get_proposal(current_user.id, proposal_id, db)
    duplicate = Proposal(
        user_id=current_user.id,
        lead_id=proposal.lead_id,
        version=1,
        proposal_type=proposal.proposal_type,
        title=proposal.title,
        executive_summary=proposal.executive_summary,
        problem_statement=proposal.problem_statement,
        proposed_approach=proposal.proposed_approach,
        timeline=proposal.timeline,
        pricing_table=proposal.pricing_table,
        total_price=proposal.total_price,
        currency=proposal.currency,
        status="Draft",
        notes=proposal.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    try:
        db.add(duplicate)
        db.commit()
        db.refresh(duplicate)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return _decorate_proposal(duplicate)


@router.post("/{proposal_id}/mark-sent", response_model=ProposalOut)
def mark_proposal_sent(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = _get_proposal(current_user.id, proposal_id, db)
    proposal.status = "Sent"
    proposal.sent_at = datetime.utcnow()
    proposal.updated_at = datetime.utcnow()

    lead = proposal.lead
    if lead:
        previous_stage = lead.pipeline_stage
        if previous_stage not in {"Proposal Sent", "Closed Won", "Closed Lost"}:
            lead.pipeline_stage = "Proposal Sent"
            lead.status = "Proposal Sent"
        db.add(lead)
        db.add(
            PipelineEvent(
                user_id=current_user.id,
                lead_id=lead.id,
                event_type="proposal_sent",
                from_stage=previous_stage,
                to_stage=lead.pipeline_stage,
                created_at=datetime.utcnow(),
            )
        )

    try:
        db.commit()
        db.refresh(proposal)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")

    send_proposal_sent_notification(
        current_user.email,
        proposal.lead.company_name if proposal.lead else "Unknown Company",
        proposal.title,
    )

    return _decorate_proposal(proposal)


@router.get("/{proposal_id}/export-html", response_class=HTMLResponse)
def export_proposal_html(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = _get_proposal(current_user.id, proposal_id, db)
    context = {
        "consultant_name": current_user.email,
        "consultant_email": current_user.email,
        "lead_company": proposal.lead.company_name if proposal.lead else "",
        "contact_name": proposal.lead.contact_name if proposal.lead else "",
        "proposal": proposal,
    }
    template = env.get_template("proposal_template.html")
    html = template.render(context)
    return HTMLResponse(content=html)
