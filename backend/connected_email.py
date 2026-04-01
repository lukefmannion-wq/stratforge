import base64
import os
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import EmailAccount, User
from .outreach import mark_message_sent
from .schemas import EmailAccountOut, EmailSendRequest
from .token_refresh import encrypt_value, get_valid_access_token

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
]

router = APIRouter(prefix="/api/email", tags=["connected-email"])


def _get_google_oauth_credentials() -> tuple[str, str]:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on this deployment.",
        )
    return GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET


def _build_flow(redirect_uri: str) -> Flow:
    client_id, client_secret = _get_google_oauth_credentials()
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    return Flow.from_client_config(client_config, scopes=GMAIL_SCOPES, redirect_uri=redirect_uri)


def _build_redirect_uri(request: Request) -> str:
    return str(request.url_for("gmail_callback"))


@router.get("/auth/gmail")
def gmail_auth_url(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    flow = _build_flow(_build_redirect_uri(request))
    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=str(current_user.id),
    )
    return {"authorization_url": authorization_url}


@router.get("/auth/gmail/callback", name="gmail_callback")
def gmail_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    try:
        user_id = int(state)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")

    try:
        user = db.query(User).filter(User.id == user_id).first()
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    flow = _build_flow(_build_redirect_uri(request))
    try:
        flow.fetch_token(code=code)
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to exchange OAuth code.")

    credentials = flow.credentials
    if not credentials.token or not credentials.refresh_token or not credentials.expiry:
        raise HTTPException(status_code=502, detail="Incomplete OAuth token response.")

    gmail_service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
    profile = gmail_service.users().getProfile(userId="me").execute()
    email_address = profile.get("emailAddress")
    if not email_address:
        raise HTTPException(status_code=502, detail="Could not determine connected Gmail address.")

    expires_at = credentials.expiry
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    try:
        existing_account = (
            db.query(EmailAccount)
            .filter(
                EmailAccount.user_id == user.id,
                EmailAccount.provider == "gmail",
                EmailAccount.email_address == email_address,
            )
            .first()
        )
        if existing_account:
            existing_account.access_token = encrypt_value(credentials.token)
            existing_account.refresh_token = encrypt_value(credentials.refresh_token)
            existing_account.token_expires_at = expires_at
            existing_account.is_active = True
            db.add(existing_account)
        else:
            db.add(
                EmailAccount(
                    user_id=user.id,
                    provider="gmail",
                    email_address=email_address,
                    access_token=encrypt_value(credentials.token),
                    refresh_token=encrypt_value(credentials.refresh_token),
                    token_expires_at=expires_at,
                    is_active=True,
                    created_at=datetime.utcnow(),
                )
            )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")

    return RedirectResponse(url=f"{FRONTEND_URL}/settings/email", status_code=302)


@router.get("/accounts", response_model=list[EmailAccountOut])
def list_connected_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        accounts = (
            db.query(EmailAccount)
            .filter(EmailAccount.user_id == current_user.id)
            .order_by(EmailAccount.created_at.desc())
            .all()
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return accounts


@router.delete("/accounts/{account_id}")
def delete_connected_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        account = (
            db.query(EmailAccount)
            .filter(EmailAccount.id == account_id, EmailAccount.user_id == current_user.id)
            .first()
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email account not found")

    try:
        db.delete(account)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error — please try again")
    return {"detail": "Account disconnected"}


@router.post("/send")
def send_email(
    payload: EmailSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        account = (
            db.query(EmailAccount)
            .filter(
                EmailAccount.id == payload.account_id,
                EmailAccount.user_id == current_user.id,
                EmailAccount.is_active.is_(True),
            )
            .first()
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error — please try again")
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connected email account not found")
    if account.provider != "gmail":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only Gmail is currently supported.")

    access_token = get_valid_access_token(account, db)
    credentials = Credentials(token=access_token)
    gmail_service = build("gmail", "v1", credentials=credentials, cache_discovery=False)

    if payload.html:
        mime_message = MIMEMultipart("alternative")
        mime_message.attach(MIMEText(payload.body, "plain"))
        mime_message.attach(MIMEText(payload.html, "html"))
    else:
        mime_message = MIMEText(payload.body, "plain")

    mime_message["To"] = payload.to_email
    mime_message["Subject"] = payload.subject

    raw_message = base64.urlsafe_b64encode(mime_message.as_bytes()).decode()

    try:
        gmail_service.users().messages().send(userId="me", body={"raw": raw_message}).execute()
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to send Gmail message.")

    if payload.message_id is not None:
        mark_message_sent(payload.message_id, current_user=current_user, db=db)

    return {"success": True}
