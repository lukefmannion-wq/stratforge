import json
import os
from datetime import datetime, timezone

import anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth import (create_access_token, get_current_user, hash_password,
                   verify_password)
from database import Base, SessionLocal, engine, get_db
from leads import router as leads_router
from outreach import router as outreach_router
from pipeline import router as pipeline_router
from proposals import router as proposals_router
from billing import router as billing_router
from connected_email import router as connected_email_router
from models import ConsultantProfile, Lead, OutreachMessage, User
from schemas import (ConsultantProfileOut, ProfileInput, ProfileUpdate,
                      TokenResponse, UserCreate, OnboardingStatus)
from emails import send_welcome_email
from fastapi.templating import Jinja2Templates

load_dotenv()

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests — please wait a moment"},
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response

templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


def _build_claude_prompt(data: ProfileInput) -> str:
    return (
        "You are an expert consultant strategist. "
        "Read the consultant background and return only valid JSON with the keys: "
        "service_offerings, ideal_client_profile, and value_proposition. "
        "service_offerings should be an array of 3-5 concise service names. "
        "ideal_client_profile should be an object with industries, roles, company_size, "
        "and pain_points. value_proposition should be a single compelling sentence. "
        "Do not include any additional text outside the JSON object.\n\n"
        "Consultant background:\n"
        f"Resume/background: {data.resume_text}\n"
        f"Past projects: {data.past_projects}\n"
        f"Target industries: {data.target_industries}\n"
        f"Key outcomes: {data.key_outcomes}"
    )


def _parse_claude_response(completion_text: str) -> dict:
    trimmed = completion_text.strip()
    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Failed to parse Claude JSON response")
    json_text = trimmed[start:end + 1]
    return json.loads(json_text)


@app.post("/api/auth/signup", response_model=TokenResponse)
@limiter.limit("10/minute")
def signup(request: Request, user_create: UserCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(User).filter(User.email == user_create.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered",
            )
        user = User(
            email=user_create.email,
            hashed_password=hash_password(user_create.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        send_welcome_email(user.email, getattr(user, "full_name", None))
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, user_create: UserCreate, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == user_create.email).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not user or not verify_password(user_create.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/expertise/generate", response_model=ConsultantProfileOut)
def generate_expertise(
    payload: ProfileInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is not configured on this deployment.",
        )

    prompt = _build_claude_prompt(payload)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APITimeoutError:
        raise HTTPException(status_code=504, detail="AI generation timed out — please try again.")
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    result = _parse_claude_response(response.content[0].text)
    profile_data = {
        "service_offerings": result.get("service_offerings", []),
        "ideal_client_profile": result.get("ideal_client_profile", {}),
        "value_proposition": result.get("value_proposition", ""),
    }
    raw_inputs = json.dumps({
        "resume_text": payload.resume_text,
        "past_projects": payload.past_projects,
        "target_industries": payload.target_industries,
        "key_outcomes": payload.key_outcomes,
    })
    try:
        profile = db.query(ConsultantProfile).filter(ConsultantProfile.user_id == current_user.id).first()
        if profile:
            profile.raw_inputs = raw_inputs
            profile.service_offerings = profile_data["service_offerings"]
            profile.ideal_client_profile = profile_data["ideal_client_profile"]
            profile.value_proposition = profile_data["value_proposition"]
        else:
            profile = ConsultantProfile(
                user_id=current_user.id,
                raw_inputs=raw_inputs,
                service_offerings=profile_data["service_offerings"],
                ideal_client_profile=profile_data["ideal_client_profile"],
                value_proposition=profile_data["value_proposition"],
            )
            db.add(profile)
        db.commit()
        db.refresh(profile)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return profile


app.include_router(leads_router)
app.include_router(outreach_router)
app.include_router(proposals_router)
app.include_router(pipeline_router)
app.include_router(billing_router)
app.include_router(connected_email_router)


@app.get("/api/expertise/profile", response_model=ConsultantProfileOut)
def get_expertise_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.query(ConsultantProfile).filter(ConsultantProfile.user_id == current_user.id).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultant profile not found",
        )
    return profile


@app.put("/api/expertise/profile", response_model=ConsultantProfileOut)
def update_expertise_profile(
    updates: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.query(ConsultantProfile).filter(ConsultantProfile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consultant profile not found",
            )
        if updates.raw_inputs is not None:
            profile.raw_inputs = updates.raw_inputs
        if updates.service_offerings is not None:
            profile.service_offerings = updates.service_offerings
        if updates.ideal_client_profile is not None:
            profile.ideal_client_profile = updates.ideal_client_profile
        if updates.value_proposition is not None:
            profile.value_proposition = updates.value_proposition
        db.commit()
        db.refresh(profile)
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return profile


@app.get("/")
def read_root():
    return {"message": "StratForge API is running"}


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/onboarding/status", response_model=OnboardingStatus)
def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        has_profile = db.query(ConsultantProfile).filter(ConsultantProfile.user_id == current_user.id).first() is not None
        has_lead = db.query(Lead).filter(Lead.user_id == current_user.id).first() is not None
        has_outreach = db.query(OutreachMessage).filter(OutreachMessage.user_id == current_user.id).first() is not None
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")

    return OnboardingStatus(
        has_profile=has_profile,
        has_lead=has_lead,
        has_outreach=has_outreach,
    )
