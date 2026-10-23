from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write

REPO_DATA = Path(__file__).parents[2] / "data"

THANDI = {
    "english_hl": 72, "mathematics": 68, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip


@pytest.fixture
def real_data(engine: Engine) -> None:
    write(engine, read(REPO_DATA))


def test_scores_verified_schemes_and_says_so_for_the_rest(
    client: TestClient, real_data: None
) -> None:
    body = client.post("/v1/aps/preview", json={"marks": THANDI}).json()
    by_id = {row["institution_id"]: row for row in body}
    assert by_id["wits"]["score"] == 41
    assert by_id["uj"]["score"] is None  # not verified yet


def test_unknown_subject_is_refused(client: TestClient, real_data: None) -> None:
    response = client.post("/v1/aps/preview", json={"marks": {"astrology": 90}})
    assert response.status_code == 422
    assert "astrology" in response.json()["error"]["message"]


def test_marks_must_be_0_to_100(client: TestClient, real_data: None) -> None:
    response = client.post("/v1/aps/preview", json={"marks": {"mathematics": 101}})
    assert response.status_code == 422


def test_too_many_subjects_is_refused(client: TestClient, real_data: None) -> None:
    marks = {f"s{i}": 50 for i in range(16)}
    assert client.post("/v1/aps/preview", json={"marks": marks}).status_code == 422


def test_rate_limited(client: TestClient, real_data: None) -> None:
    statuses = [
        client.post("/v1/aps/preview", json={"marks": THANDI}).status_code for _ in range(31)
    ]
    assert statuses[-1] == 429
