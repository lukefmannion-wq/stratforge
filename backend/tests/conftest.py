import os
from typing import Dict

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import case as sa_case
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")

from backend.database import Base, get_db
from backend.main import app
from backend.models import ConsultantProfile, User


@pytest.fixture()
def db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield session
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def mock_external_generation(monkeypatch: pytest.MonkeyPatch):
    def fake_hash_password(password: str) -> str:
        return f"hashed::{password}"

    def fake_verify_password(plain_password: str, hashed_password: str) -> bool:
        return hashed_password == f"hashed::{plain_password}"

    def fake_enrich_and_score_lead(lead, profile, db):
        lead.fit_score = "High"
        lead.signal_justification = "Strong fit due to relevant industry and clear buying signal."
        lead.enrichment_data = {"source": "pytest"}
        db.add(lead)
        db.commit()
        db.refresh(lead)
        return lead

    def fake_generate_message(profile, lead, message_type, sequence_number, original_email_body):
        subject = "Quick idea for growth" if message_type == "cold_email" else None
        return {
            "subject_line": subject,
            "body": f"Generated {message_type} body for {lead.company_name}",
        }

    def fake_generate_proposal(profile, lead, payload):
        pricing_table = [
            {"description": "Discovery", "quantity": 10, "unit_price": 100.0, "total": 1000.0},
            {"description": "Execution", "quantity": 20, "unit_price": 120.0, "total": 2400.0},
        ]
        return {
            "title": f"Growth plan for {lead.company_name}",
            "executive_summary": "We will increase pipeline velocity.",
            "problem_statement": "Pipeline quality and conversion are below target.",
            "proposed_approach": [
                {
                    "phase_name": "Phase 1",
                    "description": "Audit and strategy",
                    "deliverables": ["Audit", "Roadmap"],
                    "acceptance_criteria": ["Signoff"],
                }
            ],
            "timeline": "6 weeks",
            "pricing_table": pricing_table,
            "total_price": sum(item["total"] for item in pricing_table),
        }

    def compat_case(whens, else_=None):
        if isinstance(whens, (list, tuple)):
            return sa_case(*whens, else_=else_)
        return sa_case(whens, else_=else_)

    monkeypatch.setattr("backend.main.hash_password", fake_hash_password)
    monkeypatch.setattr("backend.main.verify_password", fake_verify_password)
    monkeypatch.setattr("backend.leads.case", compat_case)
    monkeypatch.setattr("backend.leads.enrich_and_score_lead", fake_enrich_and_score_lead)
    monkeypatch.setattr("backend.outreach._generate_message", fake_generate_message)
    monkeypatch.setattr("backend.proposals._generate_proposal", fake_generate_proposal)


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    return TestClient(app)


def _signup_and_token(client: TestClient, email: str = "tester@example.com", password: str = "pass1234") -> str:
    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture()
def auth_context(client: TestClient, db_session: Session) -> Dict[str, object]:
    email = "owner@example.com"
    token = _signup_and_token(client, email=email, password="pass1234")
    user = db_session.query(User).filter(User.email == email).first()
    assert user is not None
    return {
        "user": user,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture()
def with_profile(db_session: Session, auth_context: Dict[str, object]) -> Dict[str, object]:
    user = auth_context["user"]
    profile = ConsultantProfile(
        user_id=user.id,
        raw_inputs="{}",
        service_offerings=["Growth strategy"],
        ideal_client_profile={"industries": ["SaaS"], "roles": ["CEO"], "company_size": "11-50", "pain_points": ["pipeline"]},
        value_proposition="We build repeatable growth systems.",
    )
    db_session.add(profile)
    db_session.commit()
    return auth_context
