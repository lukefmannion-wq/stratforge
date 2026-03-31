import json
from typing import Any, Dict, Optional


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


def cold_email_prompt(profile: Any, lead: Any) -> str:
    signal = lead.signal_justification or "No strong signal available yet."
    return (
        "You are a smart outreach writer for an independent consultant. "
        "Create JSON only with keys subject_line and body. "
        "The subject line should be concise and compelling. "
        "The body should be no more than 150 words, open with a specific signal from the lead's signal justification, "
        "clearly state the consultant's value proposition in one sentence, name a specific outcome from the service offerings, "
        "and end with a single low-friction call to action. "
        "No fluff. No generic openers like 'I hope this finds you well.'\n\n"
        f"Consultant profile: {_profile_summary(profile)}\n"
        f"Lead company: {lead.company_name}\n"
        f"Contact role: {lead.contact_role or 'No contact role provided'}\n"
        f"Lead notes: {lead.notes or 'No additional notes.'}\n"
        f"Signal justification: {signal}\n"
        "Return only a valid JSON object and nothing else."
    )


def linkedin_prompt(profile: Any, lead: Any) -> str:
    return (
        "You are a LinkedIn message writer for an independent consultant. "
        "Create a personalized connection request message in JSON only with the key body. "
        "Max 300 characters. Mention one specific thing about the company, one specific thing the consultant does, and a reason to connect. "
        "Do not pitch services. Keep the tone friendly and professional.\n\n"
        f"Consultant profile: {_profile_summary(profile)}\n"
        f"Lead company: {lead.company_name}\n"
        f"Contact role: {lead.contact_role or 'No contact role provided'}\n"
        f"Lead notes: {lead.notes or 'No additional notes.'}\n"
        f"Signal justification: {lead.signal_justification or 'No signal available.'}\n"
        "Return only a valid JSON object and nothing else."
    )


def followup_prompt(profile: Any, lead: Any, sequence_number: int, cold_email_body: str) -> str:
    return (
        "You are an outreach follow-up writer for an independent consultant. "
        "Generate a follow-up message in JSON only with the key body. "
        "The follow-up should reference the previous message without copying it, add a new angle or piece of value, "
        "and keep a light tone. Max 100 words. "
        f"This is follow-up number {sequence_number}.\n\n"
        f"Consultant profile: {_profile_summary(profile)}\n"
        f"Lead company: {lead.company_name}\n"
        f"Contact role: {lead.contact_role or 'No contact role provided'}\n"
        f"Original cold email body: {cold_email_body or 'No prior cold email body available.'}\n"
        f"Signal justification: {lead.signal_justification or 'No signal available.'}\n"
        "Return only a valid JSON object and nothing else."
    )
