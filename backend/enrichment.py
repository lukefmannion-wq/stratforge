import json
import os
from typing import Any, Dict, Optional

import anthropic
import httpx
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from .models import ConsultantProfile, Lead

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is required in the backend .env file")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def _parse_claude_response(completion_text: str) -> Dict[str, Any]:
    trimmed = completion_text.strip()
    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Failed to parse Claude JSON response")
    json_text = trimmed[start:end + 1]
    return json.loads(json_text)


def _normalize_website_url(website: Optional[str]) -> Optional[str]:
    if not website:
        return None
    url = website.strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


def _build_lead_prompt(
    profile: Optional[ConsultantProfile],
    company_name: str,
    website_text: str,
    contact_role: Optional[str],
    notes: Optional[str],
) -> str:
    icp_text = "No consultant profile was available." if not profile else (
        "Consultant ideal client profile:\n"
        f"Industries: {json.dumps(profile.ideal_client_profile.get('industries', []))}\n"
        f"Roles: {json.dumps(profile.ideal_client_profile.get('roles', []))}\n"
        f"Company size: {json.dumps(profile.ideal_client_profile.get('company_size', ''))}\n"
        f"Pain points: {json.dumps(profile.ideal_client_profile.get('pain_points', []))}\n"
    )
    website_summary = website_text or "Website content was unavailable or could not be fetched."
    contact_info = contact_role or "No contact role provided."
    notes_text = notes or "No additional notes provided."

    return (
        f"{anthropic.HUMAN_PROMPT}You are a senior consultant analyst for a SaaS app. "
        "Evaluate how well this target company matches the consultant's ideal client profile. "
        "Return only valid JSON with the keys: fit_score and signal_justification. "
        "fit_score must be one of High, Medium, or Low. "
        "signal_justification must be exactly two sentences that reference specific signals from the website text or notes." 
        "Do not include anything else besides the JSON object.\n\n"
        "Consultant details:\n"
        f"{icp_text}\n\n"
        f"Company name: {company_name}\n"
        f"Website text: {website_summary}\n"
        f"Contact role: {contact_info}\n"
        f"Notes: {notes_text}\n"
        f"{anthropic.AI_PROMPT}"
    )


def enrich_and_score_lead(lead: Lead, profile: Optional[ConsultantProfile], db: Session) -> Lead:
    website_url = _normalize_website_url(lead.company_website)
    website_text = ""
    enrichment_data: Dict[str, Any] = {
        "company_name": lead.company_name,
        "company_website": lead.company_website,
        "fetch": {},
    }

    if website_url:
        try:
            response = httpx.get(website_url, timeout=10.0, follow_redirects=True)
            response.raise_for_status()
            website_text = response.text[:1000]
            enrichment_data["fetch"] = {
                "success": True,
                "url": website_url,
                "status_code": response.status_code,
                "snippet": website_text,
            }
        except Exception as exc:
            enrichment_data["fetch"] = {
                "success": False,
                "url": website_url,
                "error": str(exc),
            }
            website_text = ""
    else:
        enrichment_data["fetch"] = {
            "success": False,
            "url": website_url,
            "error": "No valid website URL provided.",
        }

    prompt = _build_lead_prompt(
        profile,
        lead.company_name,
        website_text,
        lead.contact_role,
        lead.notes,
    )

    try:
        response = client.completions.create(
            model="claude-3.5",
            prompt=prompt,
            max_tokens_to_sample=400,
            temperature=0.2,
            stop_sequences=["\n\n"],
        )
        result = _parse_claude_response(response.completion)
        fit_score = result.get("fit_score", "Unable to analyze")
        signal_justification = result.get("signal_justification", "Unable to analyze")
        if fit_score not in {"High", "Medium", "Low"}:
            fit_score = "Unable to analyze"
        enrichment_data["claude_response"] = result
    except Exception as exc:
        fit_score = "Unable to analyze"
        signal_justification = "Unable to analyze due to enrichment failure."
        enrichment_data["claude_error"] = str(exc)

    lead.fit_score = fit_score
    lead.signal_justification = signal_justification
    lead.enrichment_data = enrichment_data
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
