from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.conftest import Session as Signed
from tests.conftest import sign_in
from tests.test_onboarding import born
from tests.test_seed import REPO_DATA, dataset

THANDI = {
    "english_hl": 72, "mathematics": 68, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    data.institutions[0].aps_scheme = "standard_best6"
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


def active(client: TestClient, inbox: dict[str, str], email: str) -> Signed:
    s = sign_in(client, inbox, email)
    client.put("/v1/me/profile", json={"birth_date": born(18)}, headers=s.headers)
    client.post("/v1/me/consents", json={"purpose": "account", "granted": True}, headers=s.headers)
    return s


def test_saving_needs_an_active_account(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = sign_in(client, inbox, "new@example.org")
    r = client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=s.headers)
    assert r.json()["error"]["code"] == "consent_required"


def test_save_and_read_back(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    assert (
        client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=s.headers).status_code
        == 200
    )
    assert client.get("/v1/me/marks", headers=s.headers).json() == {"gr11_final": THANDI}


def test_saving_a_period_replaces_it(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=s.headers)
    client.put("/v1/me/marks/gr11_final", json={"marks": {"mathematics": 50}}, headers=s.headers)
    assert client.get("/v1/me/marks", headers=s.headers).json() == {
        "gr11_final": {"mathematics": 50}
    }


def test_unknown_period_is_refused(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    assert (
        client.put("/v1/me/marks/gr13", json={"marks": THANDI}, headers=s.headers).status_code
        == 422
    )


def test_marks_are_private(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    a = active(client, inbox, "a@example.org")
    b = active(client, inbox, "b@example.org")
    client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=a.headers)
    assert client.get("/v1/me/marks", headers=b.headers).json() == {}


def test_check_uses_the_newest_saved_marks(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    weak = dict(THANDI, mathematics=40)
    client.put("/v1/me/marks/gr11_final", json={"marks": weak}, headers=s.headers)
    client.put("/v1/me/marks/gr12_june", json={"marks": THANDI}, headers=s.headers)
    body = client.post("/v1/programmes/uj.bsc-it/check", json={}, headers=s.headers).json()
    assert body["checks"][1]["yours"] == "Mathematics 68%"


def test_check_without_saved_marks_says_so(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.post("/v1/programmes/uj.bsc-it/check", json={}, headers=s.headers)
    assert r.json()["error"]["message"] == "Save your marks first."
