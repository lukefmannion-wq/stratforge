def test_signup_valid_credentials_returns_token(client):
    response = client.post(
        "/api/auth/signup",
        json={"email": "newuser@example.com", "password": "pass1234"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"


def test_signup_duplicate_email_returns_400(client):
    payload = {"email": "duplicate@example.com", "password": "pass1234"}
    first = client.post("/api/auth/signup", json=payload)
    second = client.post("/api/auth/signup", json=payload)
    assert first.status_code == 200
    assert second.status_code == 400


def test_login_correct_credentials_returns_token(client):
    signup = client.post(
        "/api/auth/signup",
        json={"email": "loginok@example.com", "password": "pass1234"},
    )
    assert signup.status_code == 200

    login = client.post(
        "/api/auth/login",
        json={"email": "loginok@example.com", "password": "pass1234"},
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_login_wrong_password_returns_401(client):
    signup = client.post(
        "/api/auth/signup",
        json={"email": "wrongpass@example.com", "password": "pass1234"},
    )
    assert signup.status_code == 200

    login = client.post(
        "/api/auth/login",
        json={"email": "wrongpass@example.com", "password": "badpass"},
    )
    assert login.status_code == 401


def test_protected_endpoint_without_token_returns_401(client):
    response = client.get("/api/leads")
    assert response.status_code == 401
