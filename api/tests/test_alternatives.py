from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.routers.alternatives import near
from app.seed import read, write
from tests.test_marks import active
from tests.test_seed import REPO_DATA, dataset

# Misses the 60% maths requirement, so the BSc IT programme says no.
WITHOUT_MATHS = {
    "english_hl": 72, "mathematics": 45, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    data.institutions[0].aps_scheme = "standard_best6"
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    uj = data.institutions[0]
    diploma = uj.programmes[0].model_copy(
        update={
            "id": "uj.dip-it",
            "name": "Diploma IT",
            "qualification": "diploma",
            "min_aps": 20,
            "requirements": [],
        }
    )
    uj.programmes.append(diploma)
    tvet = uj.model_copy(update={"id": "cj", "name": "CJ TVET", "type": "tvet"})
    tvet.programmes = [
        uj.programmes[0].model_copy(
            update={
                "id": "cj.nc-it",
                "name": "NC(V) IT",
                "qualification": "nc_v",
                "min_aps": 20,
                "requirements": [],
            }
        )
    ]
    data.institutions.append(tvet)
    write(engine, data)


def test_no_alternatives_when_the_programme_qualifies(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    body = {"marks": {"mathematics": 68, "english_hl": 72, "physical_sciences": 70,
                      "life_sciences": 65, "geography": 74, "isizulu_fal": 60,
                      "life_orientation": 90}}  # fmt: skip
    r = client.post("/v1/programmes/uj.bsc-it/alternatives", json=body, headers=s.headers)
    assert r.json()["routes"] == []


def test_failing_target_gets_easier_entry_and_tvet(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    body = {"marks": WITHOUT_MATHS}
    routes = client.post(
        "/v1/programmes/uj.bsc-it/alternatives", json=body, headers=s.headers
    ).json()["routes"]
    by_key = {r["key"]: [p["id"] for p in r["items"]] for r in routes}
    assert by_key["easier_entry"] == ["uj.dip-it"]
    assert by_key["tvet"] == ["cj.nc-it"]
    assert set(by_key["same_field"]) <= {"cj.nc-it"}


def test_alternatives_need_marks(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.post("/v1/programmes/uj.bsc-it/alternatives", json={}, headers=s.headers)
    assert r.status_code == 404


def test_alternatives_need_sign_in(client: TestClient, seeded: None) -> None:
    r = client.post("/v1/programmes/uj.bsc-it/alternatives", json={"marks": WITHOUT_MATHS})
    assert r.status_code == 401


def test_plan_b_keeps_funding_and_work_in_the_same_field() -> None:
    def opp(name: str, field: str | None) -> SimpleNamespace:
        return SimpleNamespace(name=name, field_id=field)

    pairs = [
        (opp("cars", "engineering"), "a"),
        (opp("any", None), "b"),
        (opp("code", "it.web"), "c"),
    ]
    kept = near(pairs, SimpleNamespace(field_id="it.software"))  # type: ignore[arg-type]
    assert [o.name for o, _ in kept] == ["code", "any"]
