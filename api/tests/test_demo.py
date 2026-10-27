"""Email and password sign-in for persistent demo learner accounts."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.fake_auth import FakeAuth
from app.mail import ConsoleMailer
from app.seed import read, write
from tests.conftest import make_client
from tests.test_seed import REPO_DATA

SECRET = "x" * 40
BODY = {"email": "learner@example.org", "password": "long-enough-demo-password"}


@pytest.fixture
def repo_data(engine: Engine) -> None:
    write(engine, read(REPO_DATA))


@pytest.fixture
def demo(engine: Engine, identity: FakeAuth, mailer: ConsoleMailer) -> TestClient:
    return make_client(engine, identity, mailer, demo_secret=SECRET)


def test_demo_credentials_are_disabled_without_a_secret(client: TestClient) -> None:
    assert client.post("/v1/auth/demo/register", json=BODY).status_code == 404
    assert client.post("/v1/auth/demo/login", json=BODY).status_code == 404


def test_demo_account_keeps_onboarding_and_marks_after_sign_out_and_login(
    demo: TestClient, repo_data: None
) -> None:
    created = demo.post("/v1/auth/demo/register", json=BODY)
    assert created.status_code == 200
    headers = {"authorization": f"Bearer {created.json()['access_token']}"}
    assert (
        demo.put("/v1/me/profile", json={"birth_date": "2005-03-01"}, headers=headers).status_code
        == 200
    )
    assert (
        demo.post(
            "/v1/me/consents", json={"purpose": "account", "granted": True}, headers=headers
        ).status_code
        == 200
    )
    marks = {"english_hl": 72, "mathematics": 68}
    assert (
        demo.put("/v1/me/marks/gr12_june", json={"marks": marks}, headers=headers).status_code
        == 200
    )
    assert (
        demo.post(
            "/v1/auth/sign-out",
            json={"refresh_token": created.json()["refresh_token"]},
            headers=headers,
        ).status_code
        == 204
    )

    signed_in = demo.post("/v1/auth/demo/login", json=BODY)
    assert signed_in.status_code == 200
    after_login = {"authorization": f"Bearer {signed_in.json()['access_token']}"}
    me = demo.get("/v1/me/details", headers=after_login).json()
    assert me["status"] == "active"
    assert me["birth_date"] == "2005-03-01"
    assert demo.get("/v1/me/marks", headers=after_login).json() == {"gr12_june": marks}
    assert demo.get("/v1/me/opportunities?kind=bursary", headers=after_login).status_code == 200


def test_demo_login_rejects_wrong_password(demo: TestClient) -> None:
    assert demo.post("/v1/auth/demo/register", json=BODY).status_code == 200
    wrong = demo.post("/v1/auth/demo/login", json={**BODY, "password": "another-long-password"})
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "invalid_credentials"


def test_duplicate_demo_email_is_reported(demo: TestClient) -> None:
    assert demo.post("/v1/auth/demo/register", json=BODY).status_code == 200
    duplicate = demo.post("/v1/auth/demo/register", json=BODY)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "account_exists"


def test_demo_password_must_meet_minimum_length(demo: TestClient) -> None:
    short = demo.post("/v1/auth/demo/register", json={"email": BODY["email"], "password": "short"})
    assert short.status_code == 422
