"""One learner's whole journey through the API, on the seeded data."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.conftest import sign_in
from tests.test_onboarding import born
from tests.test_seed import REPO_DATA

MARKS = {
    "english_hl": 72, "mathematics": 68, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip


@pytest.fixture
def repo_data(engine: Engine) -> None:
    write(engine, read(REPO_DATA))


def test_learner_journey_end_to_end(
    client: TestClient, inbox: dict[str, str], repo_data: None, engine: Engine
) -> None:
    s = sign_in(client, inbox, "journey@example.org")
    h = s.headers

    # Onboarding: birthday, account and optional consents, interests.
    assert (
        client.put(
            "/v1/me/profile", json={"birth_date": born(18), "province": "Gauteng"}, headers=h
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/v1/me/consents", json={"purpose": "account", "granted": True}, headers=h
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/v1/me/consents", json={"purpose": "low_data", "granted": True}, headers=h
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/v1/me/profile", json={"birth_date": born(18), "interests": ["it"]}, headers=h
        ).status_code
        == 200
    )
    me = client.get("/v1/me/details", headers=h).json()
    assert me["status"] == "active"
    assert "low_data" in me["consents"]

    # Marks, then the verdict and the list of programmes.
    assert client.put("/v1/me/marks/gr12_june", json={"marks": MARKS}, headers=h).status_code == 200
    programmes = client.get("/v1/programmes").json()["items"]
    assert programmes
    first = programmes[0]["id"]
    verdict = client.post(f"/v1/programmes/{first}/check", json={}, headers=h)
    assert verdict.status_code == 200
    assert verdict.json()["outcome"]
    batch = client.post("/v1/programmes/checks", json={}, headers=h)
    assert batch.status_code == 200
    assert first in {row["programme_id"] for row in batch.json()}

    # Plan, saved items, an application to track.
    assert client.put("/v1/me/plan", json={"programme_ids": [first]}, headers=h).status_code == 200
    assert client.get("/v1/me/plan", headers=h).json()["targets"][0]["programme_id"] == first
    assert (
        client.post(
            "/v1/me/saved", json={"target_kind": "programme", "target_id": first}, headers=h
        ).status_code
        == 201
    )
    saved = client.get("/v1/me/saved", headers=h).json()
    assert saved and saved[0]["target_id"] == first
    app_row = client.post(
        "/v1/me/applications", json={"target_kind": "programme", "target_id": first}, headers=h
    )
    assert app_row.status_code == 201
    assert (
        client.patch(
            f"/v1/me/applications/{app_row.json()['id']}", json={"status": "submitted"}, headers=h
        ).status_code
        == 200
    )

    # The learner's data can be exported, and the export holds what they entered.
    export = client.get("/v1/me/export", headers=h).json()
    assert export["marks"] and export["plan"] == [first]
    assert "low_data" in [c["purpose"] for c in export["consents"]]
