from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session

from app import models as m
from tests.conftest import Session as Signed
from tests.test_onboarding import APPROVE, born, guardian_link, minor  # noqa: F401


def approve(client: TestClient, learner: Signed) -> str:
    """Approve as the guardian; returns the withdrawal token shown on the approve page."""
    reply = client.post(f"/v1/guardian/{guardian_link(client, learner)}", json=APPROVE)
    token: str = reply.json()["withdraw_token"]
    return token


def test_approval_shows_a_withdrawal_link(
    client: TestClient,
    minor: Signed,  # noqa: F811
) -> None:
    assert approve(client, minor)


def test_withdrawal_restricts_the_learner(
    client: TestClient,
    minor: Signed,  # noqa: F811
) -> None:
    token = approve(client, minor)
    assert client.get(f"/v1/guardian/withdraw/{token}").json()["guardian_name"] == "Mrs Dlamini"
    assert client.post(f"/v1/guardian/withdraw/{token}").status_code == 204

    me = client.get("/v1/me/details", headers=minor.headers).json()
    assert me["status"] == "restricted"
    assert me["consents"] == []
    marks = client.put(
        "/v1/me/marks/gr11_final", json={"marks": {"mathematics": 60}}, headers=minor.headers
    )
    assert marks.status_code == 403


def test_withdrawal_link_works_once(
    client: TestClient,
    minor: Signed,  # noqa: F811
) -> None:
    token = approve(client, minor)
    assert client.post(f"/v1/guardian/withdraw/{token}").status_code == 204
    assert client.post(f"/v1/guardian/withdraw/{token}").status_code == 404


def test_made_up_withdrawal_link_is_refused(client: TestClient) -> None:
    assert client.get("/v1/guardian/withdraw/nope").status_code == 404


def test_at_eighteen_the_learner_confirms_the_guardians_choices(
    client: TestClient,
    minor: Signed,  # noqa: F811
    engine: Engine,
) -> None:
    client.post(
        f"/v1/guardian/{guardian_link(client, minor)}",
        json={**APPROVE, "purposes": []},
    )
    with Session(engine) as db, db.begin():
        db.execute(
            update(m.Profile)
            .where(m.Profile.first_name == "Thandi")
            .values(birth_date=date.fromisoformat(born(18)))
        )

    me = client.get("/v1/me/details", headers=minor.headers).json()
    assert me["reconfirm"] == ["account"]
    assert me["status"] == "onboarding"

    r = client.post(
        "/v1/me/consents", json={"purpose": "account", "granted": True}, headers=minor.headers
    )
    assert r.status_code == 200
    me = client.get("/v1/me/details", headers=minor.headers).json()
    assert me["reconfirm"] == []
    assert me["status"] == "active"
