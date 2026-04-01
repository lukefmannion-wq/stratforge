import json
import os
from datetime import datetime
from typing import Any, List, Optional, Tuple

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from .auth import get_current_user
from .database import get_db
from .feature_limits import check_limit, get_limits_for_tier
from .models import ConsultantProfile, Lead, OutreachMessage, PipelineEvent, User
from .outreach_prompts import (cold_email_prompt, followup_prompt,
                               linkedin_prompt)
from .schemas import (OutreachGenerateRequest, OutreachMessageOut,
                      OutreachMessageUpdate, OutreachSequenceRequest)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is required in the backend .env file")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

router = APIRouter(prefix="/api/outreach", tags=["outreach"])

VALID_MESSAGE_TYPES = {"cold_email", "linkedin", "followup", "followup_1", "followup_2", "followup_3"}


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


def _get_message(user_id: int, message_id: int, db: Session) -> OutreachMessage:
    try:
        message = (
            db.query(OutreachMessage)
            .options(selectinload(OutreachMessage.lead))
            .filter(OutreachMessage.id == message_id, OutreachMessage.user_id == user_id)
            .first()
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return message


def _decorate_message(message: OutreachMessage) -> OutreachMessage:
    if message.lead:
        setattr(message, 'company_name', message.lead.company_name)
        setattr(message, 'contact_name', message.lead.contact_name)
        setattr(message, 'contact_role', message.lead.contact_role)
    return message


def _normalize_followup_type(message_type: str, user_id: int, lead_id: int, db: Session) -> Tuple[str, int]:
    try:
        existing = db.query(OutreachMessage).filter(
            OutreachMessage.user_id == user_id,
            OutreachMessage.lead_id == lead_id,
            OutreachMessage.message_type.like("followup%"),
        ).all()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if message_type == "followup":
        next_number = len({m.message_type for m in existing}) + 1
        if next_number > 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All three follow-up messages have already been generated.",
            )
        return f"followup_{next_number}", next_number

    if message_type.startswith("followup_"):
        try:
            sequence_number = int(message_type.split("_")[-1])
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid followup type.")
        if sequence_number not in {1, 2, 3}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid followup sequence number.")
        return message_type, sequence_number

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message type.")


def _get_cold_email_body(user_id: int, lead_id: int, db: Session) -> str:
    try:
        message = db.query(OutreachMessage).filter(
            OutreachMessage.user_id == user_id,
            OutreachMessage.lead_id == lead_id,
            OutreachMessage.message_type == "cold_email",
        ).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return message.body if message else ""


def _generate_message(
    profile: ConsultantProfile,
    lead: Lead,
    message_type: str,
    sequence_number: Optional[int],
    original_email_body: Optional[str],
) -> dict:
    if message_type == "cold_email":
        prompt = cold_email_prompt(profile, lead)
    elif message_type == "linkedin":
        prompt = linkedin_prompt(profile, lead)
    else:
        prompt = followup_prompt(profile, lead, sequence_number or 1, original_email_body or "")

    try:
        response = client.completions.create(
            model="claude-3.5",
            prompt=prompt,
            max_tokens_to_sample=400,
            temperature=0.2,
            stop_sequences=["\n\n"],
            timeout=30.0,
        )
    except anthropic.APITimeoutError:
        raise HTTPException(status_code=504, detail="AI generation timed out — please try again.")
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    result = _parse_claude_response(response.completion)
    subject_line = result.get("subject_line") if message_type == "cold_email" else None
    body = result.get("body") or ""
    return {"subject_line": subject_line, "body": body}


def _create_or_update_message(
    current_user: User,
    lead: Lead,
    message_type: str,
    subject_line: Optional[str],
    body: str,
    db: Session,
) -> OutreachMessage:
    try:
        message = db.query(OutreachMessage).filter(
            OutreachMessage.user_id == current_user.id,
            OutreachMessage.lead_id == lead.id,
            OutreachMessage.message_type == message_type,
        ).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if message:
        message.subject_line = subject_line
        message.body = body
        message.status = "Draft"
        message.generated_at = datetime.utcnow()
        message.notes = message.notes
    else:
        message = OutreachMessage(
            user_id=current_user.id,
            lead_id=lead.id,
            message_type=message_type,
            subject_line=subject_line,
            body=body,
            status="Draft",
            generated_at=datetime.utcnow(),
        )
        db.add(message)
    try:
        db.commit()
        db.refresh(message)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return _decorate_message(message)


@router.post("/generate", response_model=OutreachMessageOut)
def generate_outreach(
    request: OutreachGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.message_type not in {"cold_email", "linkedin", "followup", "followup_1", "followup_2", "followup_3"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message type.")
    lead = _get_lead(current_user.id, request.lead_id, db)
    profile = _get_profile(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consultant profile is required for outreach generation.")

    now = datetime.utcnow()
    try:
        monthly_count = db.query(OutreachMessage).filter(
            OutreachMessage.user_id == current_user.id,
            extract("year", OutreachMessage.generated_at) == now.year,
            extract("month", OutreachMessage.generated_at) == now.month,
        ).count()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    check_limit(current_user, "max_outreach_per_month", monthly_count)

    if request.message_type.startswith("followup"):
        normalized_type, sequence_number = _normalize_followup_type(request.message_type, current_user.id, lead.id, db)
        original_body = _get_cold_email_body(current_user.id, lead.id, db)
        if not original_body:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cold email must exist before generating follow-up messages.")
    else:
        normalized_type = request.message_type
        sequence_number = None
        original_body = None

    result = _generate_message(profile, lead, normalized_type, sequence_number, original_body)
    return _create_or_update_message(current_user, lead, normalized_type, result.get("subject_line"), result["body"], db)


@router.post("/generate-sequence", response_model=List[OutreachMessageOut])
def generate_sequence(
    request: OutreachSequenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _get_lead(current_user.id, request.lead_id, db)
    profile = _get_profile(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consultant profile is required for outreach generation.")

    limits = get_limits_for_tier(current_user.subscription_tier)
    if not limits["can_generate_sequence"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your current plan does not allow full sequence generation. Upgrade to access this feature.")

    now = datetime.utcnow()
    try:
        monthly_count = db.query(OutreachMessage).filter(
            OutreachMessage.user_id == current_user.id,
            extract("year", OutreachMessage.generated_at) == now.year,
            extract("month", OutreachMessage.generated_at) == now.month,
        ).count()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if monthly_count + 5 > limits["max_outreach_per_month"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Generating a full sequence would exceed your monthly outreach limit of {limits['max_outreach_per_month']} messages. Upgrade to send more.",
        )

    order = ["cold_email", "linkedin", "followup_1", "followup_2", "followup_3"]
    messages: List[OutreachMessage] = []

    cold_email_result = _generate_message(profile, lead, "cold_email", None, None)
    cold_email_message = _create_or_update_message(current_user, lead, "cold_email", cold_email_result.get("subject_line"), cold_email_result["body"], db)
    messages.append(cold_email_message)

    linkedin_result = _generate_message(profile, lead, "linkedin", None, None)
    linkedin_message = _create_or_update_message(current_user, lead, "linkedin", None, linkedin_result["body"], db)
    messages.append(linkedin_message)

    for index in range(1, 4):
        message_type = f"followup_{index}"
        followup_result = _generate_message(profile, lead, message_type, index, cold_email_result["body"])
        message = _create_or_update_message(current_user, lead, message_type, None, followup_result["body"], db)
        messages.append(message)

    return messages


@router.get("", response_model=List[OutreachMessageOut])
def list_outreach(
    lead_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        query = (
            db.query(OutreachMessage)
            .options(selectinload(OutreachMessage.lead))
            .filter(OutreachMessage.user_id == current_user.id)
        )
        if lead_id is not None:
            query = query.filter(OutreachMessage.lead_id == lead_id)
        messages = query.order_by(OutreachMessage.generated_at.desc()).all()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return [_decorate_message(message) for message in messages]


@router.get("/{message_id}", response_model=OutreachMessageOut)
def get_outreach_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _decorate_message(_get_message(current_user.id, message_id, db))


@router.put("/{message_id}", response_model=OutreachMessageOut)
def update_outreach_message(
    message_id: int,
    updates: OutreachMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = _get_message(current_user.id, message_id, db)
    try:
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(message, field, value)
        db.commit()
        db.refresh(message)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return message


@router.delete("/{message_id}")
def delete_outreach_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = _get_message(current_user.id, message_id, db)
    try:
        db.delete(message)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return {"detail": "Message deleted"}


@router.post("/{message_id}/mark-sent", response_model=OutreachMessageOut)
def mark_message_sent(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = _get_message(current_user.id, message_id, db)
    message.status = "Sent"
    message.sent_at = datetime.utcnow()

    lead = message.lead
    if lead:
        previous_stage = lead.pipeline_stage
        if previous_stage == "Identified":
            lead.pipeline_stage = "Outreach Sent"
            lead.status = "Outreach Sent"
        db.add(lead)
        db.add(
            PipelineEvent(
                user_id=current_user.id,
                lead_id=lead.id,
                event_type="outreach_sent",
                from_stage=previous_stage,
                to_stage=lead.pipeline_stage,
                created_at=datetime.utcnow(),
            )
        )

    try:
        db.commit()
        db.refresh(message)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return message
