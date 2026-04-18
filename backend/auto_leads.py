import json
import logging
import os

import anthropic
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from models import ConsultantProfile, Lead, User

logger = logging.getLogger(__name__)


def identify_leads_from_profile(user: User, profile: ConsultantProfile, db: Session) -> list[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not set — skipping auto lead generation")
        return []

    client = anthropic.Anthropic(api_key=api_key)

    industries = profile.industries_of_expertise or []
    interests = profile.industries_of_interest or []
    areas = profile.consulting_areas or []
    target = profile.target_client_type or {}
    engagement_types = profile.past_engagement_types or []
    uvp = profile.unique_value_proposition or ""
    years = profile.years_of_experience or 0
    company_sizes = target.get("company_size", [])
    client_roles = target.get("client_roles", [])
    geo_focus = target.get("geographic_focus", [])

    prompt = f"""You are a business development expert identifying ideal clients for a consultant.

CONSULTANT PROFILE:
- Name: {profile.full_name or "Not provided"}
- Title: {profile.professional_title or "Not provided"}
- Years of Experience: {years}
- Industries of Expertise: {", ".join(industries) if industries else "Not specified"}
- Industries of Interest: {", ".join(interests) if interests else "Not specified"}
- Consulting Areas: {", ".join(areas) if areas else "Not specified"}
- Target Company Sizes: {", ".join(company_sizes) if company_sizes else "Not specified"}
- Target Client Roles: {", ".join(client_roles) if client_roles else "Not specified"}
- Geographic Focus: {", ".join(geo_focus) if geo_focus else "Not specified"}
- Past Engagement Types: {", ".join(engagement_types) if engagement_types else "Not specified"}
- Unique Value Proposition: {uvp if uvp else "Not specified"}

Generate exactly 10 high-quality lead suggestions. Each must be a REAL, SPECIFIC company that genuinely needs this consultant's expertise RIGHT NOW based on current industry dynamics.

Rules:
- Match company sizes to target (do NOT suggest Fortune 500 if they target SMBs)
- Match geographic focus exactly
- Use the consultant's actual industries and roles — do NOT generate generic companies
- The signal_justification must reference specific, real reasons this company needs THIS consultant's exact skills
- Assign "High" fit_score only if 3+ dimensions match perfectly (industry, size, role, geography)

Return ONLY a valid JSON array with exactly 10 objects, each with these exact keys:
- "company_name": string
- "company_website": string (real URL, e.g. "https://example.com")
- "contact_role": string (specific role title matching target client roles)
- "signal_justification": string (exactly 2 sentences: why this company needs this consultant RIGHT NOW)
- "fit_score": string (exactly "High", "Medium", or "Low")
- "industry": string

Return the JSON array only — no markdown, no explanation."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1:
            logger.error("No JSON array found in Claude lead generation response")
            return []
        leads_data = json.loads(text[start:end + 1])
    except Exception as exc:
        logger.error(f"Lead generation Claude call failed: {exc}")
        return []

    created = []
    for item in leads_data[:10]:
        try:
            lead = Lead(
                user_id=user.id,
                company_name=item.get("company_name", "Unknown Company"),
                company_website=item.get("company_website"),
                contact_role=item.get("contact_role"),
                fit_score=item.get("fit_score"),
                signal_justification=item.get("signal_justification"),
                enrichment_data={"industry": item.get("industry"), "source": "ai_onboarding"},
                status="Identified",
                pipeline_stage="Identified",
            )
            db.add(lead)
            db.flush()
            created.append({
                "id": lead.id,
                "company_name": lead.company_name,
                "company_website": lead.company_website,
                "contact_role": lead.contact_role,
                "fit_score": lead.fit_score,
                "signal_justification": lead.signal_justification,
                "industry": item.get("industry"),
                "status": lead.status,
                "pipeline_stage": lead.pipeline_stage,
            })
        except Exception as exc:
            logger.error(f"Error building lead record: {exc}")
            continue

    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Error committing leads: {exc}")
        return []

    return created
