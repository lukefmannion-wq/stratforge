from datetime import datetime
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
