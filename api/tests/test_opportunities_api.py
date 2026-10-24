from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.test_marks import THANDI, active
from tests.test_onboarding import born
from tests.test_seed import REPO_DATA, dataset

BURSARY = [
    {
        "id": "gp-bursary",
        "name": "Gauteng bursary",
        "kind": "bursary",
        "provider": "Gauteng Dept",
        "url": "https://www.gauteng.gov.za/",
        "criteria": [{"check": "province", "values": ["Gauteng"]}],
        "source": "s",
    },
    {
        "id": "open-bursary",
        "name": "Open bursary",
        "kind": "bursary",
        "provider": "Trust",
        "url": "https://www.gov.za/",
        "criteria": [{"check": "household_income", "number": 350000}],
        "source": "s",
    },
]


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path, **{"opportunities.yaml": BURSARY}))
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


def set_province(client: TestClient, s: object, province: str) -> None:
    client.put(
        "/v1/me/profile",
        json={"birth_date": born(18), "province": province},
        headers=s.headers,  # type: ignore[attr-defined]
    )


def test_browse_needs_no_sign_in(client: TestClient, seeded: None) -> None:
    names = [o["name"] for o in client.get("/v1/opportunities").json()]
    assert sorted(names) == ["Gauteng bursary", "Open bursary"]


def test_browse_filters_by_kind(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/opportunities?kind=work").json() == []


def test_matched_for_me_drops_firm_misses(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    set_province(client, s, "Gauteng")
    by_name = {o["name"]: o for o in client.get("/v1/me/opportunities", headers=s.headers).json()}
    assert by_name["Gauteng bursary"]["verdict"] == "qualifies"
    assert by_name["Open bursary"]["verdict"] == "may_qualify"


def test_other_province_is_not_shown(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    set_province(client, s, "Western Cape")
    names = [o["name"] for o in client.get("/v1/me/opportunities", headers=s.headers).json()]
    assert names == ["Open bursary"]


def test_funding_appears_in_plan_b(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    set_province(client, s, "Gauteng")
    failing = {**THANDI, "mathematics": 45}
    body = client.post(
        "/v1/programmes/uj.bsc-it/alternatives", json={"marks": failing}, headers=s.headers
    ).json()
    assert {o["name"] for o in body["funding"]} == {"Gauteng bursary", "Open bursary"}


def test_one_opportunity_by_id(client: TestClient, seeded: None) -> None:
    body = client.get("/v1/opportunities/gp-bursary").json()
    assert body["name"] == "Gauteng bursary"
    assert client.get("/v1/opportunities/nope").status_code == 404
