import re
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session

from app import models as m
from app.fake_auth import FakeAuth
from app.mail import ConsoleMailer
from tests.conftest import Session as Signed
from tests.conftest import sign_in


def born(years_ago: int, days: int = 0) -> str:
    today = date.today()
    return str(today.replace(year=today.year - years_ago) - timedelta(days=days))


def profile(client: TestClient, s: Signed, birth: str) -> dict[str, object]:
    r = client.put(
        "/v1/me/profile", json={"first_name": "Thandi", "birth_date": birth}, headers=s.headers
    )
    return r.json()  # type: ignore[no-any-return]


def consent(client: TestClient, s: Signed, purpose: str, granted: bool = True) -> int:
    body = {"purpose": purpose, "granted": granted}
    return client.post("/v1/me/consents", json=body, headers=s.headers).status_code


@pytest.fixture
def adult(client: TestClient, inbox: dict[str, str]) -> Signed:
    s = sign_in(client, inbox, "adult@example.org")
    profile(client, s, born(18))
    return s


@pytest.fixture
def minor(client: TestClient, inbox: dict[str, str]) -> Signed:
    s = sign_in(client, inbox, "minor@example.org")
    assert profile(client, s, born(17))["status"] == "pending_guardian"
    return s


def guardian_link(client: TestClient, s: Signed, mailer: ConsoleMailer) -> str:
    body = {"guardian_name": "Mrs Dlamini", "guardian_email": "parent@example.org"}
    assert client.post("/v1/me/guardian", json=body, headers=s.headers).status_code == 204
    match = re.search(r"/guardian/(\S+)", mailer.sent[-1][2])
    assert match
    return match.group(1)


APPROVE = {
    "decision": "approve",
    "relationship": "parent",
    "declaration": True,
    "purposes": ["reminders"],
}


# Adults


def test_adult_is_active_only_after_account_consent(client: TestClient, adult: Signed) -> None:
    assert client.get("/v1/me/details", headers=adult.headers).json()["status"] == "onboarding"
    assert consent(client, adult, "account") == 200
    assert client.get("/v1/me/details", headers=adult.headers).json()["status"] == "active"


def test_withdrawing_account_consent_deactivates(client: TestClient, adult: Signed) -> None:
    consent(client, adult, "account")
    consent(client, adult, "account", granted=False)
    me = client.get("/v1/me/details", headers=adult.headers).json()
    assert (me["status"], me["consents"]) == ("onboarding", [])


def test_consent_needs_a_birth_date_first(client: TestClient, inbox: dict[str, str]) -> None:
    s = sign_in(client, inbox, "new@example.org")
    assert consent(client, s, "account") == 403


# Under 17


def test_under_17_keeps_nothing(
    client: TestClient, inbox: dict[str, str], engine: Engine, identity: FakeAuth
) -> None:
    s = sign_in(client, inbox, "kid@example.org")
    r = client.put("/v1/me/profile", json={"birth_date": born(17, days=-1)}, headers=s.headers)
    assert r.json()["error"]["code"] == "too_young"
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(m.User)) == 0
        assert db.scalar(select(func.count()).select_from(m.Profile)) == 0
    with pytest.raises(StopIteration):
        identity.email_of("anything")


# 17-year-olds and guardians


def test_minor_cannot_consent_alone(client: TestClient, minor: Signed) -> None:
    assert consent(client, minor, "account") == 403


def test_guardian_email_must_differ_from_learner(client: TestClient, minor: Signed) -> None:
    body = {"guardian_name": "Me", "guardian_email": "Minor@Example.org"}
    assert client.post("/v1/me/guardian", json=body, headers=minor.headers).status_code == 403


def test_guardian_approval_activates_with_chosen_purposes(
    client: TestClient, minor: Signed, mailer: ConsoleMailer
) -> None:
    token = guardian_link(client, minor, mailer)
    assert mailer.sent[-1][0] == "parent@example.org"
    assert client.get(f"/v1/guardian/{token}").json()["learner_first_name"] == "Thandi"
    assert client.post(f"/v1/guardian/{token}", json=APPROVE).status_code == 204

    me = client.get("/v1/me/details", headers=minor.headers).json()
    assert me["status"] == "active"
    assert me["consents"] == ["account", "reminders"]
    # Something the guardian didn't allow stays off.
    assert consent(client, minor, "ai_writing") == 403


def test_approval_needs_the_declaration(
    client: TestClient, minor: Signed, mailer: ConsoleMailer
) -> None:
    token = guardian_link(client, minor, mailer)
    body = dict(APPROVE, declaration=False)
    assert client.post(f"/v1/guardian/{token}", json=body).status_code == 422


def test_link_works_once(client: TestClient, minor: Signed, mailer: ConsoleMailer) -> None:
    token = guardian_link(client, minor, mailer)
    client.post(f"/v1/guardian/{token}", json=APPROVE)
    assert client.post(f"/v1/guardian/{token}", json=APPROVE).status_code == 404


def test_expired_link_is_refused(
    client: TestClient, minor: Signed, mailer: ConsoleMailer, engine: Engine
) -> None:
    token = guardian_link(client, minor, mailer)
    with engine.begin() as db:
        db.execute(
            update(m.GuardianRequest).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    assert client.get(f"/v1/guardian/{token}").status_code == 404


def test_made_up_link_is_refused(client: TestClient) -> None:
    assert client.get("/v1/guardian/not-a-real-token").status_code == 404


def test_decline_removes_the_profile(
    client: TestClient, minor: Signed, mailer: ConsoleMailer, engine: Engine
) -> None:
    token = guardian_link(client, minor, mailer)
    assert client.post(f"/v1/guardian/{token}", json={"decision": "decline"}).status_code == 204
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(m.Profile)) == 0


def test_adults_cannot_ask_for_guardian_approval(client: TestClient, adult: Signed) -> None:
    body = {"guardian_name": "X", "guardian_email": "x@example.org"}
    assert client.post("/v1/me/guardian", json=body, headers=adult.headers).status_code == 403


def test_guardian_emails_are_limited(client: TestClient, minor: Signed) -> None:
    body = {"guardian_name": "P", "guardian_email": "parent@example.org"}
    codes = [
        client.post("/v1/me/guardian", json=body, headers=minor.headers).status_code
        for _ in range(4)
    ]
    assert codes == [204, 204, 204, 429]
