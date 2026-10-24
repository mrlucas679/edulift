from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app import models as m
from app.routers import verdicts as batch
from app.seed import read, write
from tests.conftest import sign_in
from tests.test_seed import REPO_DATA, dataset

THANDI = {
    "english_hl": 72, "mathematics": 68, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    # Test institution uses best-6; programme needs APS 30 and Maths 60.
    data = read(dataset(tmp_path))
    data.institutions[0].aps_scheme = "standard_best6"
    data.subjects.subjects = read(REPO_DATA).subjects.subjects  # the real NSC list
    write(engine, data)


def test_needs_sign_in(client: TestClient, seeded: None) -> None:
    response = client.post("/v1/programmes/uj.bsc-it/check", json={"marks": THANDI})
    assert response.status_code == 401


def test_verdict_lists_every_check(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    session = sign_in(client, inbox, "a@example.org")
    body = client.post(
        "/v1/programmes/uj.bsc-it/check", json={"marks": THANDI}, headers=session.headers
    ).json()
    # The test window closed on 2026-10-31; today may be before or after that.
    assert body["outcome"] in {"qualifies", "closed"}
    assert body["score"] == 33
    assert [(c["name"], c["result"]) for c in body["checks"]] == [
        ("score", "pass"),
        ("subjects_1", "pass"),
    ]
    assert body["checks"][1]["required"] == "Mathematics 60%"
    assert all(c["source_url"].startswith("https://") for c in body["checks"])
    assert "institution decides" in body["note"]


def test_marks_are_not_stored(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    session = sign_in(client, inbox, "a@example.org")
    client.post("/v1/programmes/uj.bsc-it/check", json={"marks": THANDI}, headers=session.headers)
    with Session(engine) as db:
        # Only the reference tables and users exist; nothing holds marks.
        assert db.scalar(select(func.count()).select_from(m.User)) == 0


def test_unknown_programme_is_404(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    session = sign_in(client, inbox, "a@example.org")
    response = client.post(
        "/v1/programmes/nope/check", json={"marks": THANDI}, headers=session.headers
    )
    assert response.status_code == 404


def test_batch_verdicts_cover_every_programme(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    session = sign_in(client, inbox, "batch@example.org")
    body = client.post(
        "/v1/programmes/me/outcomes", json={"marks": THANDI}, headers=session.headers
    ).json()
    assert isinstance(body, list)
    assert {row["programme_id"] for row in body} == {
        p["id"] for p in client.get("/v1/programmes").json()["items"]
    }


def test_batch_verdicts_are_cached_until_marks_change(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    batch._BATCH_CACHE.clear()
    session = sign_in(client, inbox, "cache@example.org")
    client.post("/v1/programmes/me/outcomes", json={"marks": THANDI}, headers=session.headers)
    before = len(batch._BATCH_CACHE)
    client.post("/v1/programmes/me/outcomes", json={"marks": THANDI}, headers=session.headers)
    assert len(batch._BATCH_CACHE) == before
    changed = {**THANDI, "mathematics": 40}
    client.post("/v1/programmes/me/outcomes", json={"marks": changed}, headers=session.headers)
    assert len(batch._BATCH_CACHE) == before + 1
