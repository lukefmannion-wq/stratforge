from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    consultant_profile = relationship("ConsultantProfile", back_populates="user", uselist=False)
    leads = relationship("Lead", back_populates="user", cascade="all, delete-orphan")


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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="leads")
