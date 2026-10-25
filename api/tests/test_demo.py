"""The "Try the demo" sign-in: off by default, and a fake learner with no email."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.demo import DEMO_ISSUER, DEMO_SUBJECT, demo_token
from app.fake_auth import FakeAuth
from app.mail import ConsoleMailer
from app.seed import read, write
from tests.conftest import make_client
from tests.test_seed import REPO_DATA

SECRET = "x" * 40


@pytest.fixture
def repo_data(engine: Engine) -> None:
    write(engine, read(REPO_DATA))


@pytest.fixture
def demo(engine: Engine, identity: FakeAuth, mailer: ConsoleMailer) -> TestClient:
    return make_client(engine, identity, mailer, demo_secret=SECRET)


def test_demo_is_off_without_a_secret(client: TestClient) -> None:
    assert client.post("/v1/auth/demo").status_code == 404


def test_demo_token_is_only_accepted_with_the_secret(demo: TestClient) -> None:
    token = demo_token(SECRET)
    assert demo.get("/v1/me", headers={"authorization": f"Bearer {token}"}).status_code == 200
    forged = demo_token("y" * 40)
    assert demo.get("/v1/me", headers={"authorization": f"Bearer {forged}"}).status_code == 401


def test_demo_sign_in_starts_a_fresh_learner(demo: TestClient, repo_data: None) -> None:
    r = demo.post("/v1/auth/demo")
    assert r.status_code == 200
    h = {"authorization": f"Bearer {r.json()['access_token']}"}
    me = demo.get("/v1/me/details", headers=h).json()
    assert me["id"] == DEMO_SUBJECT and me["status"] == "onboarding"
    # A fresh learner has no marks yet, and the account must be set up before saving any.
    assert demo.get("/v1/me/marks", headers=h).status_code == 403


def test_each_demo_sign_in_starts_over(demo: TestClient, repo_data: None) -> None:
    h = {"authorization": f"Bearer {demo.post('/v1/auth/demo').json()['access_token']}"}
    demo.put("/v1/me/profile", json={"birth_date": "2005-03-01"}, headers=h)
    again = demo.post("/v1/auth/demo").json()["access_token"]
    me = demo.get("/v1/me/details", headers={"authorization": f"Bearer {again}"}).json()
    assert me["birth_date"] is None


def test_expired_demo_token_is_refused(demo: TestClient) -> None:
    old = jwt.encode(
        {"sub": DEMO_SUBJECT, "iss": DEMO_ISSUER, "client_id": "demo", "token_use": "access",
         "exp": datetime.now(UTC) - timedelta(minutes=1)},
        SECRET, algorithm="HS256",
    )  # fmt: skip
    assert demo.get("/v1/me", headers={"authorization": f"Bearer {old}"}).status_code == 401
