from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from eligibility.aps import score

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


def test_ukzn_six_subjects_count_in_full() -> None:
    # Prospectus p.17 worked example, with ratings turned into percents for each level.
    marks = {"english_hl": 62, "english_fal": 75, "mathematics": 62, "accounting": 75,
             "business_studies": 75, "it": 85, "life_orientation": 55}  # fmt: skip
    assert score("ukzn_aps", marks) == 5 + 6 + 5 + 6 + 6 + 7


def test_ukzn_gives_eight_points_from_ninety() -> None:
    marks = dict.fromkeys(["english_hl", "mathematics", "physical_sciences", "geography",
                           "life_sciences", "isizulu_fal"], 90)  # fmt: skip
    assert score("ukzn_aps", marks) == 48


def test_ukzn_seven_subjects_keep_english_maths_and_best_four() -> None:
    marks = {
        "english_hl": 40,
        "english_fal": 65,
        "mathematics": 50,
        "physical_sciences": 90,
        "geography": 85,
        "life_sciences": 70,
        "history": 55,
        "life_orientation": 90,
    }
    # English 65 -> 5, Maths 50 -> 4, best four others: 8, 7, 6, 4
    assert score("ukzn_aps", marks) == 5 + 4 + 8 + 7 + 6 + 4
