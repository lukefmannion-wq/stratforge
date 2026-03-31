from fastapi import HTTPException, status

FEATURE_LIMITS = {
    "free": {
        "max_leads": 5,
        "max_outreach_per_month": 10,
        "max_proposals": 2,
        "can_import_csv": False,
        "can_generate_sequence": False,
    },
    "solo": {
        "max_leads": 25,
        "max_outreach_per_month": 50,
        "max_proposals": 10,
        "can_import_csv": True,
        "can_generate_sequence": True,
    },
    "growth": {
        "max_leads": 100,
        "max_outreach_per_month": 200,
        "max_proposals": 50,
        "can_import_csv": True,
        "can_generate_sequence": True,
    },
    "agency": {
        "max_leads": 999999,
        "max_outreach_per_month": 999999,
        "max_proposals": 999999,
        "can_import_csv": True,
        "can_generate_sequence": True,
    },
}

LIMIT_LABELS = {
    "max_leads": "lead",
    "max_outreach_per_month": "outreach message",
    "max_proposals": "proposal",
}

UPGRADE_MAP = {
    "free": "Solo",
    "solo": "Growth",
    "growth": "Agency",
    "agency": "Agency",
}


def _normalize_tier(tier: str) -> str:
    return tier.lower() if isinstance(tier, str) else "free"


def get_limits_for_tier(tier: str) -> dict:
    return FEATURE_LIMITS.get(_normalize_tier(tier), FEATURE_LIMITS["free"])


def check_limit(user, limit_name: str, current_count: int) -> None:
    tier = _normalize_tier(getattr(user, "subscription_tier", "free"))
    limits = get_limits_for_tier(tier)
    if limit_name not in limits:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown limit requested.")

    limit_value = limits[limit_name]
    if isinstance(limit_value, bool):
        return

    if current_count >= limit_value:
        label = LIMIT_LABELS.get(limit_name, limit_name.replace("max_", "").replace("_", " "))
        next_tier = UPGRADE_MAP.get(tier, "Agency")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You have reached the {limit_value} {label} limit on the {tier} plan. Upgrade to {next_tier} to add more.",
        )
