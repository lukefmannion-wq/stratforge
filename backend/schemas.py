from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileInput(BaseModel):
    resume_text: str
    past_projects: str
    target_industries: str
    key_outcomes: str


class ProfileUpdate(BaseModel):
    raw_inputs: Optional[str] = None
    service_offerings: Optional[List[str]] = None
    ideal_client_profile: Optional[Dict[str, Any]] = None
    value_proposition: Optional[str] = None


class ConsultantProfileOut(BaseModel):
    service_offerings: List[str]
    ideal_client_profile: Dict[str, Any]
    value_proposition: str
    created_at: datetime

    class Config:
        orm_mode = True


class LeadBase(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    notes: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    pipeline_stage: Optional[str] = None
    deal_value: Optional[float] = None
    expected_close_date: Optional[date] = None
    fit_score: Optional[str] = None
    signal_justification: Optional[str] = None
    enrichment_data: Optional[Dict[str, Any]] = None


class LeadOut(LeadBase):
    id: int
    fit_score: Optional[str] = None
    signal_justification: Optional[str] = None
    enrichment_data: Optional[Dict[str, Any]] = None
    status: str
    pipeline_stage: str
    deal_value: Optional[float] = None
    expected_close_date: Optional[date] = None
    created_at: datetime
    outreach_count: int = 0
    proposal_count: int = 0

    class Config:
        orm_mode = True


class LeadImportResponse(BaseModel):
    imported: int
    processed: int


class OutreachMessageBase(BaseModel):
    lead_id: int
    message_type: str
    subject_line: Optional[str] = None
    body: str
    status: Optional[str] = None
    notes: Optional[str] = None


class OutreachMessageCreate(OutreachMessageBase):
    pass


class OutreachMessageUpdate(BaseModel):
    subject_line: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class OutreachMessageOut(BaseModel):
    id: int
    lead_id: int
    message_type: str
    subject_line: Optional[str] = None
    body: str
    status: str
    generated_at: datetime
    sent_at: Optional[datetime] = None
    notes: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None

    class Config:
        orm_mode = True


class OutreachGenerateRequest(BaseModel):
    lead_id: int
    message_type: str


class OutreachSequenceRequest(BaseModel):
    lead_id: int


class OutreachSequenceResponse(BaseModel):
    messages: List[OutreachMessageOut]


class ProposalPhase(BaseModel):
    phase_name: str
    description: str
    deliverables: List[str]
    acceptance_criteria: Optional[List[str]] = None


class PricingLineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float


class ProposalOut(BaseModel):
    id: int
    lead_id: int
    version: int
    proposal_type: str
    title: str
    executive_summary: str
    problem_statement: str
    proposed_approach: List[ProposalPhase]
    timeline: str
    pricing_table: List[PricingLineItem]
    total_price: float
    currency: str
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None

    class Config:
        orm_mode = True


class ProposalGenerateRequest(BaseModel):
    lead_id: int
    proposal_type: str
    scope_notes: str
    timeline_preference: str
    rate_type: str
    rate_amount: float
    currency: str = "USD"


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    executive_summary: Optional[str] = None
    problem_statement: Optional[str] = None
    proposed_approach: Optional[List[ProposalPhase]] = None
    timeline: Optional[str] = None
    pricing_table: Optional[List[PricingLineItem]] = None
    total_price: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PipelineStageUpdate(BaseModel):
    new_stage: str


class PipelineDealUpdate(BaseModel):
    deal_value: Optional[float] = None
    expected_close_date: Optional[date] = None


class PipelineNoteCreate(BaseModel):
    note: str


class PipelineEventOut(BaseModel):
    id: int
    lead_id: int
    event_type: str
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None

    class Config:
        orm_mode = True


class PipelineMetrics(BaseModel):
    total_leads: int
    leads_by_stage: Dict[str, int]
    lead_to_call_rate: float
    call_to_close_rate: float
    total_pipeline_value: float
    closed_won_value: float
    avg_deal_value: float
    outreach_response_rate: float


class ReanalyzeRequest(BaseModel):
    re_analyze: bool = False
