import json
from typing import Any


def _profile_summary(profile: Any) -> str:
    industries = profile.ideal_client_profile.get("industries")
    roles = profile.ideal_client_profile.get("roles")
    company_size = profile.ideal_client_profile.get("company_size")
    pain_points = profile.ideal_client_profile.get("pain_points")

    return (
        f"Consultant value proposition: {profile.value_proposition}. "
        f"Service offerings: {', '.join(profile.service_offerings)}. "
        f"Ideal client industries: {industries}. "
        f"Ideal roles: {roles}. "
        f"Company size: {company_size}. "
        f"Pain points: {pain_points}."
    )


def proposal_prompt(
    profile: Any,
    lead: Any,
    scope_notes: str,
    timeline_preference: str,
    rate_type: str,
    rate_amount: float,
    currency: str,
) -> str:
    return (
        "You are an expert proposal writer for an independent consultant. "
        "Generate a high-quality business proposal in JSON only. "
        "Return only a valid JSON object with the keys: title, executive_summary, problem_statement, "
        "proposed_approach, timeline, pricing_table, total_price. "
        "The proposal should feel bespoke and reference the lead's company, contact role, and at least one specific signal from signal_justification. "
        "The executive_summary should be 2–3 sentences. The problem_statement should be 2–3 sentences and specifically tie to the lead's situation. "
        "proposed_approach should be an array of 3–4 phases. Each phase must include phase_name, description, and deliverables (array of strings). "
        "timeline should be a plain English string such as '8 weeks from signed agreement.' "
        "pricing_table should be an array of line items with description, quantity, unit_price, and total. "
        "total_price should be the numeric sum of the pricing table totals. "
        "Use the requested rate structure: if hourly, estimate hours per phase; if project-based, break into milestone line items. "
        "Do not include any additional text outside the JSON object.\n\n"
        f"Consultant profile: {_profile_summary(profile)}\n"
        f"Lead company: {lead.company_name}\n"
        f"Contact role: {lead.contact_role or 'No contact role provided'}\n"
        f"Lead notes: {lead.notes or 'No additional notes.'}\n"
        f"Signal justification: {lead.signal_justification or 'No signal available.'}\n"
        f"Scope notes: {scope_notes}\n"
        f"Timeline preference: {timeline_preference}\n"
        f"Rate type: {rate_type}\n"
        f"Rate amount: {rate_amount}\n"
        f"Currency: {currency}\n"
        "Return only a valid JSON object and nothing else."
    )


def sow_prompt(
    profile: Any,
    lead: Any,
    scope_notes: str,
    timeline_preference: str,
    rate_type: str,
    rate_amount: float,
    currency: str,
) -> str:
    return (
        "You are a Statement of Work writer for an independent consultant. "
        "Generate a formal, contract-ready Statement of Work in JSON only. "
        "Return only a valid JSON object with the keys: title, executive_summary, problem_statement, "
        "proposed_approach, timeline, pricing_table, total_price. "
        "The executive_summary should be 2–3 sentences. The problem_statement should be 2–3 sentences and specifically tie to the lead's situation. "
        "proposed_approach should be an array of 3–4 phases. Each phase must include phase_name, description, deliverables (array of strings), and acceptance_criteria (array of strings). "
        "timeline should include specific milestone dates relative to a project kickoff date. "
        "pricing_table should include payment schedule items such as 30% on signing, 40% at midpoint, 30% on completion, with description, quantity, unit_price, and total. "
        "total_price should be the numeric sum of the pricing table totals. "
        "The tone must be formal, precise, and suitable for legal review. "
        "Reference the lead company name, the contact's role, and at least one signal from signal_justification. "
        "Do not include any additional text outside the JSON object.\n\n"
        f"Consultant profile: {_profile_summary(profile)}\n"
        f"Lead company: {lead.company_name}\n"
        f"Contact role: {lead.contact_role or 'No contact role provided'}\n"
        f"Lead notes: {lead.notes or 'No additional notes.'}\n"
        f"Signal justification: {lead.signal_justification or 'No signal available.'}\n"
        f"Scope notes: {scope_notes}\n"
        f"Timeline preference: {timeline_preference}\n"
        f"Rate type: {rate_type}\n"
        f"Rate amount: {rate_amount}\n"
        f"Currency: {currency}\n"
        "Return only a valid JSON object and nothing else."
    )
