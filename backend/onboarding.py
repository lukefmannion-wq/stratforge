from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth import get_current_user
from auto_leads import identify_leads_from_profile
from database import get_db
from models import ConsultantProfile, User
from schemas import OnboardingProfileOut, OnboardingStepInput

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.put("/step", response_model=OnboardingProfileOut)
def save_onboarding_step(
    data: OnboardingStepInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.query(ConsultantProfile).filter(
            ConsultantProfile.user_id == current_user.id
        ).first()
        if not profile:
            profile = ConsultantProfile(user_id=current_user.id)
            db.add(profile)

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(profile, field, value)

        db.commit()
        db.refresh(profile)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return profile


@router.post("/complete")
def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.query(ConsultantProfile).filter(
            ConsultantProfile.user_id == current_user.id
        ).first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found — complete the onboarding steps first.",
            )
        profile.onboarding_completed = True
        db.commit()
        db.refresh(profile)
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")

    leads = identify_leads_from_profile(current_user, profile, db)
    return {"leads": leads}


@router.get("/status")
def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.query(ConsultantProfile).filter(
            ConsultantProfile.user_id == current_user.id
        ).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")

    if not profile:
        return {"onboarding_completed": False, "profile": None}

    return {
        "onboarding_completed": profile.onboarding_completed,
        "profile": OnboardingProfileOut.model_validate(profile),
    }
