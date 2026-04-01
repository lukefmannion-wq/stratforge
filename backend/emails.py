import os

import resend
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL")


def _send_email(to_email: str, subject: str, html: str) -> bool:
    try:
        if not RESEND_API_KEY or not FROM_EMAIL:
            return False
        resend.api_key = RESEND_API_KEY
        resend.Emails.send(
            {
                "from": FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
        return True
    except Exception:
        return False


def send_welcome_email(user_email: str, user_name: str) -> bool:
    try:
        safe_name = user_name or "there"
        html = (
            f"<p>Hi {safe_name},</p>"
            "<p>Welcome to StratForge Growth. Here are the three steps to get started:</p>"
            "<ol>"
            "<li>Complete your onboarding profile so StratForge can understand your expertise.</li>"
            "<li>Add your first leads and review fit scores and signal justifications.</li>"
            "<li>Generate outreach and proposals, then move opportunities through your pipeline.</li>"
            "</ol>"
            "<p>You are ready to start building momentum.</p>"
        )
        return _send_email(user_email, "Welcome to StratForge Growth", html)
    except Exception:
        return False


def send_proposal_sent_notification(user_email: str, company_name: str, proposal_title: str) -> bool:
    try:
        html = (
            f"<p>Your proposal was marked as sent.</p>"
            f"<p><strong>Company:</strong> {company_name}<br>"
            f"<strong>Proposal:</strong> {proposal_title}</p>"
            "<p>Track response and follow-up activity in your pipeline.</p>"
        )
        return _send_email(user_email, "Proposal marked as sent", html)
    except Exception:
        return False


def send_deal_won_notification(user_email: str, company_name: str, deal_value: float) -> bool:
    try:
        formatted_value = f"${deal_value:,.2f}"
        html = (
            "<p>Congratulations, you just closed a deal in StratForge Growth.</p>"
            f"<p><strong>Company:</strong> {company_name}<br>"
            f"<strong>Deal Value:</strong> {formatted_value}</p>"
            "<p>Keep the momentum going by adding your next opportunity.</p>"
        )
        return _send_email(user_email, "Deal won - congratulations", html)
    except Exception:
        return False
