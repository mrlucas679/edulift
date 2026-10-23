from datetime import date, timedelta
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.test_seed import dataset


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    base = dataset(tmp_path)
    inst = yaml.safe_load((base / "institutions/uj.yaml").read_text())
    today = date.today()
    inst["cycles"] = [
        {"intake_year": 2026, "opens_on": str(today - timedelta(days=200)),
         "closes_on": str(today - timedelta(days=1)), "source": "s"},
        {"intake_year": 2027, "opens_on": str(today - timedelta(days=30)),
         "closes_on": str(today + timedelta(days=10)), "source": "s"},
    ]  # fmt: skip
    inst["programmes"].append(
        {"id": "uj.dip-100", "name": "Diploma 100% online", "qualification": "diploma",
         "field": "it", "source": "s", "requirements": []}
    )  # fmt: skip
    write(engine, read(dataset(tmp_path, **{"institutions/uj.yaml": inst})))


def test_subjects_and_fields(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/subjects").json()[0]["id"] == "mathematics"
    assert client.get("/v1/fields").json() == [{"id": "it", "name": "IT", "parent_id": None}]


def test_institutions_filter(client: TestClient, seeded: None) -> None:
    assert len(client.get("/v1/institutions", params={"province": "Gauteng"}).json()) == 1
    assert client.get("/v1/institutions", params={"province": "Limpopo"}).json() == []


def test_institution_detail_shows_source_and_windows(client: TestClient, seeded: None) -> None:
    body = client.get("/v1/institutions/uj").json()
    assert body["source"]["url"] == "https://www.uj.ac.za/"
    assert body["source"]["checked_on"] is None
    assert [c["intake_year"] for c in body["cycles"]] == [2026, 2027]


def test_unknown_institution_is_404(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/institutions/nope").json()["error"]["code"] == "not_found"


def test_programme_search(client: TestClient, seeded: None) -> None:
    body = client.get("/v1/programmes", params={"q": "bsc"}).json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == "uj.bsc-it"


def test_search_treats_percent_as_text(client: TestClient, seeded: None) -> None:
    body = client.get("/v1/programmes", params={"q": "%"}).json()
    assert [p["id"] for p in body["items"]] == ["uj.dip-100"]


def test_page_size_is_capped(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/programmes", params={"page_size": 51}).status_code == 422


def test_programme_detail_groups_requirements(client: TestClient, seeded: None) -> None:
    body = client.get("/v1/programmes/uj.bsc-it").json()
    assert body["requirement_groups"] == [[{"subject_id": "mathematics", "min_percent": 60}]]
    assert body["verified"] is False


def test_deadlines_only_show_open_windows(client: TestClient, seeded: None) -> None:
    body = client.get("/v1/deadlines").json()
    assert [(d["intake_year"], d["days_left"]) for d in body] == [(2027, 10)]


def test_meta_counts_unchecked_sources(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/meta").json() == {"last_checked": None, "unchecked_sources": 1}
