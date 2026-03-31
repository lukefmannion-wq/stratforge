from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from .auth import get_current_user
from .database import get_db
from .models import Lead, PipelineEvent, User
from .schemas import (
    PipelineDealUpdate,
    PipelineEventOut,
    PipelineMetrics,
    PipelineNoteCreate,
    PipelineStageUpdate,
)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

VALID_PIPELINE_STAGES = [
    "Identified",
    "Outreach Sent",
    "Replied",
    "Call Scheduled",
    "Proposal Sent",
    "Closed Won",
    "Closed Lost",
]

CALL_REACHED_STAGES = {"Call Scheduled", "Proposal Sent", "Closed Won", "Closed Lost"}
OUTREACH_SENT_STAGES = {"Outreach Sent", "Replied", "Call Scheduled", "Proposal Sent", "Closed Won", "Closed Lost"}
RESPONDED_STAGES = {"Replied", "Call Scheduled", "Proposal Sent", "Closed Won", "Closed Lost"}


def _get_lead(user_id: int, lead_id: int, db: Session) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.user_id == user_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


def _decorate_lead(lead: Lead) -> Lead:
    lead.outreach_count = len(lead.outreach_messages)
    lead.proposal_count = len(lead.proposals)
    return lead


def _create_pipeline_event(
    user: User,
    lead: Lead,
    event_type: str,
    from_stage: str | None = None,
    to_stage: str | None = None,
    note: str | None = None,
    db: Session | None = None,
) -> PipelineEvent:
    event = PipelineEvent(
        user_id=user.id,
        lead_id=lead.id,
        event_type=event_type,
        from_stage=from_stage,
        to_stage=to_stage,
        note=note,
        created_at=datetime.utcnow(),
    )
    if db is not None:
        db.add(event)
        db.commit()
        db.refresh(event)
    return event


@router.get("")
def get_pipeline(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    leads = (
        db.query(Lead)
        .options(selectinload(Lead.outreach_messages), selectinload(Lead.proposals))
        .filter(Lead.user_id == user.id)
        .order_by(Lead.created_at.desc())
        .all()
    )
    grouped: Dict[str, List[Lead]] = {stage: [] for stage in VALID_PIPELINE_STAGES}
    for lead in leads:
        grouped.setdefault(lead.pipeline_stage, [])
        grouped[lead.pipeline_stage].append(_decorate_lead(lead))
    return grouped


@router.put("/{lead_id}/stage")
def update_pipeline_stage(
    lead_id: int,
    payload: PipelineStageUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.new_stage not in VALID_PIPELINE_STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pipeline stage.")
    lead = _get_lead(user.id, lead_id, db)
    from_stage = lead.pipeline_stage
    to_stage = payload.new_stage
    if from_stage != to_stage:
        lead.pipeline_stage = to_stage
        if to_stage == "Closed Won":
            lead.status = "Won"
        elif to_stage == "Closed Lost":
            lead.status = "Lost"
        else:
            lead.status = to_stage
        db.add(lead)
        db.commit()
        _create_pipeline_event(
            user=user,
            lead=lead,
            event_type="stage_change",
            from_stage=from_stage,
            to_stage=to_stage,
            db=db,
        )
    db.refresh(lead)
    return _decorate_lead(lead)


@router.put("/{lead_id}/deal")
def update_pipeline_deal(
    lead_id: int,
    payload: PipelineDealUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(user.id, lead_id, db)
    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _decorate_lead(lead)


@router.get("/metrics", response_model=PipelineMetrics)
def get_pipeline_metrics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    leads = db.query(Lead).filter(Lead.user_id == user.id).all()
    total_leads = len(leads)

    leads_by_stage = {stage: 0 for stage in VALID_PIPELINE_STAGES}
    call_reached = 0
    closed_won = 0
    total_pipeline_value = 0.0
    closed_won_value = 0.0
    deal_values: List[float] = []
    outreach_sent = 0
    responded = 0

    for lead in leads:
        leads_by_stage.setdefault(lead.pipeline_stage, 0)
        leads_by_stage[lead.pipeline_stage] += 1
        if lead.pipeline_stage in CALL_REACHED_STAGES:
            call_reached += 1
        if lead.pipeline_stage == "Closed Won":
            closed_won += 1
        if lead.pipeline_stage in OUTREACH_SENT_STAGES:
            outreach_sent += 1
        if lead.pipeline_stage in RESPONDED_STAGES:
            responded += 1
        if lead.deal_value is not None:
            deal_values.append(lead.deal_value)
            if lead.pipeline_stage not in {"Closed Won", "Closed Lost"}:
                total_pipeline_value += lead.deal_value
            if lead.pipeline_stage == "Closed Won":
                closed_won_value += lead.deal_value

    lead_to_call_rate = (call_reached / total_leads * 100) if total_leads else 0.0
    call_to_close_rate = (closed_won / call_reached * 100) if call_reached else 0.0
    avg_deal_value = (sum(deal_values) / len(deal_values)) if deal_values else 0.0
    outreach_response_rate = (responded / outreach_sent * 100) if outreach_sent else 0.0

    return PipelineMetrics(
        total_leads=total_leads,
        leads_by_stage=leads_by_stage,
        lead_to_call_rate=round(lead_to_call_rate, 1),
        call_to_close_rate=round(call_to_close_rate, 1),
        total_pipeline_value=round(total_pipeline_value, 2),
        closed_won_value=round(closed_won_value, 2),
        avg_deal_value=round(avg_deal_value, 2),
        outreach_response_rate=round(outreach_response_rate, 1),
    )


@router.get("/{lead_id}/activity", response_model=List[PipelineEventOut])
def get_pipeline_activity(
    lead_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(user.id, lead_id, db)
    events = (
        db.query(PipelineEvent)
        .filter(PipelineEvent.user_id == user.id, PipelineEvent.lead_id == lead.id)
        .order_by(PipelineEvent.created_at.desc())
        .all()
    )
    for event in events:
        if event.lead:
            setattr(event, "company_name", event.lead.company_name)
            setattr(event, "contact_name", event.lead.contact_name)
            setattr(event, "contact_role", event.lead.contact_role)
    return events


@router.get("/activity/recent", response_model=List[PipelineEventOut])
def get_recent_activity(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = (
        db.query(PipelineEvent)
        .filter(PipelineEvent.user_id == user.id)
        .order_by(PipelineEvent.created_at.desc())
        .limit(20)
        .all()
    )
    for event in events:
        if event.lead:
            setattr(event, "company_name", event.lead.company_name)
            setattr(event, "contact_name", event.lead.contact_name)
            setattr(event, "contact_role", event.lead.contact_role)
    return events


@router.post("/{lead_id}/note", response_model=PipelineEventOut)
def add_pipeline_note(
    lead_id: int,
    payload: PipelineNoteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(user.id, lead_id, db)
    event = _create_pipeline_event(
        user=user,
        lead=lead,
        event_type="note_added",
        note=payload.note,
        db=db,
    )
    setattr(event, "company_name", lead.company_name)
    setattr(event, "contact_name", lead.contact_name)
    setattr(event, "contact_role", lead.contact_role)
    return event
