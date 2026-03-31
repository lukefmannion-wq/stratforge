from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    consultant_profile = relationship("ConsultantProfile", back_populates="user", uselist=False)


class ConsultantProfile(Base):
    __tablename__ = "consultant_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    raw_inputs = Column(Text, nullable=False)
    service_offerings = Column(JSON, nullable=False)
    ideal_client_profile = Column(JSON, nullable=False)
    value_proposition = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="consultant_profile")
