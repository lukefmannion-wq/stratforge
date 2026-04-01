def _create_lead(client, headers):
    response = client.post(
        "/api/leads",
        headers=headers,
        json={
            "company_name": "Proposal Co",
            "company_website": "proposal.example.com",
            "contact_name": "Jordan",
            "contact_role": "Founder",
            "notes": "Needs GTM support",
        },
    )
    assert response.status_code == 200
    return response.json()["id"]


def _proposal_payload(lead_id):
    return {
        "lead_id": lead_id,
        "proposal_type": "proposal",
        "scope_notes": "Increase outbound conversion",
        "timeline_preference": "6 weeks",
        "rate_type": "project",
        "rate_amount": 3400,
        "currency": "USD",
    }


def test_generate_proposal_returns_required_fields(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers)
    response = client.post("/api/proposals/generate", headers=headers, json=_proposal_payload(lead_id))
    assert response.status_code == 200
    data = response.json()
    required = {
        "id",
        "lead_id",
        "version",
        "proposal_type",
        "title",
        "executive_summary",
        "problem_statement",
        "proposed_approach",
        "timeline",
        "pricing_table",
        "total_price",
        "currency",
        "status",
    }
    assert required.issubset(data.keys())


def test_pricing_table_total_matches_line_items(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers)
    response = client.post("/api/proposals/generate", headers=headers, json=_proposal_payload(lead_id))
    assert response.status_code == 200
    data = response.json()
    computed_total = sum(item["total"] for item in data["pricing_table"])
    assert computed_total == data["total_price"]


def test_duplicate_proposal_creates_new_record_with_version_one(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers)
    created = client.post("/api/proposals/generate", headers=headers, json=_proposal_payload(lead_id))
    assert created.status_code == 200

    original = created.json()
    duplicated = client.post(f"/api/proposals/{original['id']}/duplicate", headers=headers)
    assert duplicated.status_code == 200
    dup = duplicated.json()

    assert dup["id"] != original["id"]
    assert dup["version"] == 1
