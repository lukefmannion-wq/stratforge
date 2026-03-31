import os
from datetime import datetime
from typing import Optional

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import User
from .schemas import (
    BillingCheckoutResponse,
    BillingCreateCheckoutRequest,
    BillingPortalResponse,
    BillingSubscriptionOut,
)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_SOLO_PRICE_ID = os.getenv("STRIPE_SOLO_PRICE_ID")
STRIPE_GROWTH_PRICE_ID = os.getenv("STRIPE_GROWTH_PRICE_ID")
STRIPE_AGENCY_PRICE_ID = os.getenv("STRIPE_AGENCY_PRICE_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL")

if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is required in the backend .env file")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/billing", tags=["billing"])

VALID_TIERS = {"solo", "growth", "agency"}
PRICE_ID_MAP = {
    "solo": STRIPE_SOLO_PRICE_ID,
    "growth": STRIPE_GROWTH_PRICE_ID,
    "agency": STRIPE_AGENCY_PRICE_ID,
}


def _get_price_id(tier: str) -> str:
    price_id = PRICE_ID_MAP.get(tier)
    if not price_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Price ID is not configured for this plan.")
    return price_id


def _get_return_url(path: str, fallback: str) -> str:
    if FRONTEND_URL:
        return f"{FRONTEND_URL.rstrip('/')}/{path.lstrip('/')}"
    return fallback


@router.post("/create-checkout-session", response_model=BillingCheckoutResponse)
def create_checkout_session(
    payload: BillingCreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.tier not in VALID_TIERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tier selected.")

    price_id = _get_price_id(payload.tier)
    success_url = payload.success_url or _get_return_url("pipeline", "http://localhost:3000/pipeline")
    cancel_url = payload.cancel_url or _get_return_url("pricing", "http://localhost:3000/pricing")

    if current_user.stripe_customer_id:
        customer_id = current_user.stripe_customer_id
    else:
        customer = stripe.Customer.create(email=current_user.email)
        current_user.stripe_customer_id = customer.id
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        customer_id = customer.id

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data={"metadata": {"tier": payload.tier}},
    )

    return BillingCheckoutResponse(url=session.url)


@router.post("/webhook")
async def billing_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature or webhook secret.")

    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload.")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature.")

    event_type = event.type
    data = event.data.object

    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        metadata = data.get("metadata") or {}
        tier = metadata.get("tier", "solo")
        email = data.get("customer_email")
        user = None
        if customer_id:
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if not user and email:
            user = db.query(User).filter(User.email == email).first()
        if user:
            user.subscription_tier = tier
            user.subscription_status = "active"
            user.stripe_customer_id = customer_id or user.stripe_customer_id
            user.stripe_subscription_id = subscription_id or user.stripe_subscription_id
            db.add(user)
            db.commit()

    elif event_type == "customer.subscription.updated":
        subscription_id = data.get("id")
        status = data.get("status")
        period_end = data.get("current_period_end")
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
        if user:
            user.subscription_status = status or user.subscription_status
            if period_end:
                user.subscription_current_period_end = datetime.utcfromtimestamp(int(period_end))
            db.add(user)
            db.commit()

    elif event_type == "customer.subscription.deleted":
        subscription_id = data.get("id")
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
        if user:
            user.subscription_tier = "free"
            user.subscription_status = "canceled"
            db.add(user)
            db.commit()

    return {"status": "success"}


@router.get("/subscription", response_model=BillingSubscriptionOut)
def get_subscription(current_user: User = Depends(get_current_user)):
    return BillingSubscriptionOut(
        subscription_tier=current_user.subscription_tier,
        subscription_status=current_user.subscription_status,
        subscription_current_period_end=current_user.subscription_current_period_end,
        is_free_plan=current_user.subscription_tier == "free",
    )


@router.post("/create-portal-session", response_model=BillingPortalResponse)
def create_portal_session(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe customer is required to launch the portal.")
    return_url = _get_return_url("settings/billing", "http://localhost:3000/settings/billing")
    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=return_url,
    )
    return BillingPortalResponse(url=session.url)
