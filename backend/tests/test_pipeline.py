def _create_lead(client, headers, company_name="Pipeline Co"):
    response = client.post(
        "/api/leads",
        headers=headers,
        json={
            "company_name": company_name,
            "company_website": "pipeline.example.com",
            "contact_name": "Casey",
            "contact_role": "VP Sales",
            "notes": "In discovery",
        },
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_moving_lead_stage_creates_pipeline_event(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers)

    moved = client.put(
        f"/api/pipeline/{lead_id}/stage",
        headers=headers,
        json={"new_stage": "Replied"},
    )
    assert moved.status_code == 200

    activity = client.get(f"/api/pipeline/{lead_id}/activity", headers=headers)
    assert activity.status_code == 200
    events = activity.json()
    assert any(e["event_type"] == "stage_change" and e["from_stage"] == "Identified" and e["to_stage"] == "Replied" for e in events)


def test_metrics_endpoint_returns_required_keys(client, with_profile):
    headers = with_profile["headers"]
    _create_lead(client, headers, company_name="Metrics Co")

    response = client.get("/api/pipeline/metrics", headers=headers)
    assert response.status_code == 200
    data = response.json()
    required = {
        "total_leads",
        "leads_by_stage",
        "lead_to_call_rate",
        "call_to_close_rate",
        "total_pipeline_value",
        "closed_won_value",
        "avg_deal_value",
        "outreach_response_rate",
    }
    assert required.issubset(data.keys())


def test_adding_note_creates_note_added_pipeline_event(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers, company_name="Notes Co")

    note_response = client.post(
        f"/api/pipeline/{lead_id}/note",
        headers=headers,
        json={"note": "Follow up next Tuesday"},
    )
    assert note_response.status_code == 200
    data = note_response.json()
    assert data["event_type"] == "note_added"
    assert data["note"] == "Follow up next Tuesday"
