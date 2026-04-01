def _create_lead(client, headers, company_name):
    return client.post(
        "/api/leads",
        headers=headers,
        json={
            "company_name": company_name,
            "company_website": "example.com",
            "contact_name": "Alex",
            "contact_role": "CEO",
            "notes": "Potential fit",
        },
    )


def test_create_lead_returns_with_fit_score(client, with_profile):
    headers = with_profile["headers"]
    response = _create_lead(client, headers, "Acme Labs")
    assert response.status_code == 200
    data = response.json()
    assert data["company_name"] == "Acme Labs"
    assert data["fit_score"]


def test_free_tier_cannot_create_more_than_five_leads(client, with_profile):
    headers = with_profile["headers"]
    for i in range(5):
        response = _create_lead(client, headers, f"Company {i}")
        assert response.status_code == 200

    sixth = _create_lead(client, headers, "Company 6")
    assert sixth.status_code == 403


def test_get_all_leads_returns_sorted_list(client, with_profile):
    headers = with_profile["headers"]

    low = _create_lead(client, headers, "Low Co")
    medium = _create_lead(client, headers, "Medium Co")
    high = _create_lead(client, headers, "High Co")
    assert low.status_code == 200
    assert medium.status_code == 200
    assert high.status_code == 200

    client.put(f"/api/leads/{low.json()['id']}", headers=headers, json={"fit_score": "Low"})
    client.put(f"/api/leads/{medium.json()['id']}", headers=headers, json={"fit_score": "Medium"})
    client.put(f"/api/leads/{high.json()['id']}", headers=headers, json={"fit_score": "High"})

    response = client.get("/api/leads", headers=headers)
    assert response.status_code == 200
    scores = [item["fit_score"] for item in response.json()["items"]]
    assert scores == sorted(scores, key=lambda s: {"High": 1, "Medium": 2, "Low": 3}.get(s, 4))


def test_delete_lead_removes_it(client, with_profile):
    headers = with_profile["headers"]
    created = _create_lead(client, headers, "Delete Me")
    assert created.status_code == 200
    lead_id = created.json()["id"]

    deleted = client.delete(f"/api/leads/{lead_id}", headers=headers)
    assert deleted.status_code == 200

    leads = client.get("/api/leads", headers=headers)
    assert leads.status_code == 200
    ids = [lead["id"] for lead in leads.json()["items"]]
    assert lead_id not in ids
