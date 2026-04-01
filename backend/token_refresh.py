import os
from datetime import datetime, timedelta, timezone

import requests
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

fernet = Fernet(ENCRYPTION_KEY.encode()) if ENCRYPTION_KEY else None


def _ensure_token_refresh_configured() -> None:
    missing = []
    if not ENCRYPTION_KEY:
        missing.append("ENCRYPTION_KEY")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        missing.append("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET")
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Connected email is not configured on this deployment (missing: {', '.join(missing)}).",
        )


def encrypt_value(value: str) -> str:
    _ensure_token_refresh_configured()
    assert fernet is not None
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    _ensure_token_refresh_configured()
    assert fernet is not None
    return fernet.decrypt(value.encode()).decode()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _is_expired(token_expires_at: datetime) -> bool:
    expiry = token_expires_at
    if token_expires_at.tzinfo is None:
        expiry = token_expires_at.replace(tzinfo=timezone.utc)
    return expiry <= (_utc_now() + timedelta(seconds=60))


def get_valid_access_token(account, db: Session) -> str:
    _ensure_token_refresh_configured()
    access_token = decrypt_value(account.access_token)
    if not _is_expired(account.token_expires_at):
        return access_token

    refresh_token = decrypt_value(account.refresh_token)
    try:
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=15,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Failed to refresh Gmail token.")

    if token_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to refresh Gmail token.")

    token_data = token_response.json()
    new_access_token = token_data.get("access_token")
    expires_in = token_data.get("expires_in")
    if not new_access_token or not expires_in:
        raise HTTPException(status_code=502, detail="Failed to refresh Gmail token.")

    account.access_token = encrypt_value(new_access_token)
    account.token_expires_at = _utc_now() + timedelta(seconds=int(expires_in))

    try:
        db.add(account)
        db.commit()
        db.refresh(account)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")

    return new_access_token
