import json
import os

import anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from .auth import (create_access_token, get_current_user, hash_password,
                   verify_password)
from .database import Base, SessionLocal, engine, get_db
from .leads import router as leads_router
from .outreach import router as outreach_router
from .models import ConsultantProfile, User
from .schemas import (ConsultantProfileOut, ProfileInput, ProfileUpdate,
                      TokenResponse, UserCreate)

load_dotenv()

app = FastAPI()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is required in the backend .env file")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def _build_claude_prompt(data: ProfileInput) -> str:
    return (
        f"{anthropic.HUMAN_PROMPT}You are an expert consultant strategist. "
        "Read the consultant background and return only valid JSON with the keys: "
        "service_offerings, ideal_client_profile, and value_proposition. "
        "service_offerings should be an array of 3-5 concise service names. "
        "ideal_client_profile should be an object with industries, roles, company_size, "
        "and pain_points. value_proposition should be a single compelling sentence. "
        "Do not include any additional text outside the JSON object.\n\n"
        "Consultant background:\n"
        f"Resume/background: {data.resume_text}\n"
        f"Past projects: {data.past_projects}\n"
        f"""Target industries: {data.target_industries}\n"""
        f"Key outcomes: {data.key_outcomes}\n"
        f"{anthropic.AI_PROMPT}"
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
def signup(user_create: UserCreate, db: Session = Depends(get_db)):
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
    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(user_create: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_create.email).first()
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
    prompt = _build_claude_prompt(payload)
    response = client.completions.create(
        model="claude-3.5",
        prompt=prompt,
        max_tokens_to_sample=600,
        temperature=0.2,
        stop_sequences=["\n\n"],
    )
    result = _parse_claude_response(response.completion)
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
    return profile


app.include_router(leads_router)
app.include_router(outreach_router)


@app.get("/api/expertise/profile", response_model=ConsultantProfileOut)
def get_expertise_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(ConsultantProfile).filter(ConsultantProfile.user_id == current_user.id).first()
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
    return profile


@app.get("/")
def read_root():
    return {"message": "StratForge API is running"}
