from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.conftest import Session as Signed
from tests.test_marks import THANDI, active
from tests.test_seed import REPO_DATA, dataset


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    data.institutions[0].aps_scheme = "standard_best6"
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


def save_marks(client: TestClient, s: Signed) -> None:
    client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=s.headers)


def test_needs_sign_in(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/me/plan").status_code == 401


def test_empty_plan_without_marks(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    assert client.get("/v1/me/plan", headers=s.headers).json() == {"targets": [], "limit": 3}


def test_add_target_gets_a_verdict(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    save_marks(client, s)
    r = client.put("/v1/me/plan", json={"programme_ids": ["uj.bsc-it"]}, headers=s.headers)
    assert r.status_code == 200
    [target] = r.json()["targets"]
    assert target["programme_id"] == "uj.bsc-it"
    assert target["verdict"]["score"] == 33
    assert target["verdict"]["checks"][0]["source_url"].startswith("https://")


def test_target_without_marks_has_no_verdict(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    client.put("/v1/me/plan", json={"programme_ids": ["uj.bsc-it"]}, headers=s.headers)
    [target] = client.get("/v1/me/plan", headers=s.headers).json()["targets"]
    assert target["verdict"] is None


def test_more_than_three_targets_is_refused(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    ids = ["uj.bsc-it", "uj.a", "uj.b", "uj.c"]
    r = client.put("/v1/me/plan", json={"programme_ids": ids}, headers=s.headers)
    assert r.status_code == 422


def test_duplicate_target_is_refused(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    ids = ["uj.bsc-it", "uj.bsc-it"]
    r = client.put("/v1/me/plan", json={"programme_ids": ids}, headers=s.headers)
    assert r.status_code == 422


def test_unknown_programme_is_404(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.put("/v1/me/plan", json={"programme_ids": ["nope"]}, headers=s.headers)
    assert r.status_code == 404


def test_plans_are_private(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    a = active(client, inbox, "a@example.org")
    b = active(client, inbox, "b@example.org")
    client.put("/v1/me/plan", json={"programme_ids": ["uj.bsc-it"]}, headers=a.headers)
    assert client.get("/v1/me/plan", headers=b.headers).json()["targets"] == []
