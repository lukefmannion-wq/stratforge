def _create_lead(client, headers):
    response = client.post(
        "/api/leads",
        headers=headers,
        json={
            "company_name": "Outreach Co",
            "company_website": "outreach.example.com",
            "contact_name": "Taylor",
            "contact_role": "Head of Growth",
            "notes": "Warm signal",
        },
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_generate_cold_email_returns_body(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers)

    response = client.post(
        "/api/outreach/generate",
        headers=headers,
        json={"lead_id": lead_id, "message_type": "cold_email"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message_type"] == "cold_email"
    assert data["body"]


def test_generate_outreach_with_invalid_lead_returns_404(client, with_profile):
    headers = with_profile["headers"]
    response = client.post(
        "/api/outreach/generate",
        headers=headers,
        json={"lead_id": 999999, "message_type": "cold_email"},
    )
    assert response.status_code == 404


def test_mark_message_sent_updates_status_and_sent_at(client, with_profile):
    headers = with_profile["headers"]
    lead_id = _create_lead(client, headers)

    generated = client.post(
        "/api/outreach/generate",
        headers=headers,
        json={"lead_id": lead_id, "message_type": "cold_email"},
    )
    assert generated.status_code == 200
    message_id = generated.json()["id"]

    marked = client.post(f"/api/outreach/{message_id}/mark-sent", headers=headers)
    assert marked.status_code == 200
    data = marked.json()
    assert data["status"] == "Sent"
    assert data["sent_at"] is not None
