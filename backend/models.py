from datetime import datetime
from sqlalchemy import Column, Date, Float, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    subscription_tier = Column(String(50), nullable=False, default="free")
    subscription_status = Column(String(50), nullable=False, default="active")
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    subscription_current_period_end = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    consultant_profile = relationship("ConsultantProfile", back_populates="user", uselist=False)
    leads = relationship("Lead", back_populates="user", cascade="all, delete-orphan")
    email_accounts = relationship("EmailAccount", back_populates="user", cascade="all, delete-orphan")


class ConsultantProfile(Base):
    __tablename__ = "consultant_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    raw_inputs = Column(Text, nullable=False)
    service_offerings = Column(JSON, nullable=False)
    ideal_client_profile = Column(JSON, nullable=False)
    value_proposition = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="consultant_profile")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    company_website = Column(String(255), nullable=True)
    contact_name = Column(String(255), nullable=True)
    contact_role = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    fit_score = Column(String(50), nullable=True)
    signal_justification = Column(Text, nullable=True)
    enrichment_data = Column(JSON, nullable=True)
    status = Column(String(50), nullable=False, default="Identified")
    pipeline_stage = Column(String(50), nullable=False, default="Identified")
    deal_value = Column(Float, nullable=True)
    expected_close_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="leads")
    outreach_messages = relationship("OutreachMessage", back_populates="lead", cascade="all, delete-orphan")
    proposals = relationship("Proposal", back_populates="lead", cascade="all, delete-orphan")
    pipeline_events = relationship("PipelineEvent", back_populates="lead", cascade="all, delete-orphan")


class OutreachMessage(Base):
    __tablename__ = "outreach_messages"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    message_type = Column(String(50), nullable=False)
    subject_line = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="Draft")
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    user = relationship("User")
    lead = relationship("Lead", back_populates="outreach_messages")


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    proposal_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    executive_summary = Column(Text, nullable=False)
    problem_statement = Column(Text, nullable=False)
    proposed_approach = Column(JSON, nullable=False)
    timeline = Column(String(255), nullable=False)
    pricing_table = Column(JSON, nullable=False)
    total_price = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    status = Column(String(50), nullable=False, default="Draft")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False, onupdate=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)

    user = relationship("User")
    lead = relationship("Lead", back_populates="proposals")


class PipelineEvent(Base):
    __tablename__ = "pipeline_events"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    from_stage = Column(String(50), nullable=True)
    to_stage = Column(String(50), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    lead = relationship("Lead", back_populates="pipeline_events")


class EmailAccount(Base):
    __tablename__ = "email_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    email_address = Column(String(255), nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    token_expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="email_accounts")
