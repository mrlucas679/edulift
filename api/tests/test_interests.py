from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.conftest import Session as Signed
from tests.test_onboarding import adult, born  # noqa: F401
from tests.test_seed import dataset


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    write(engine, read(dataset(tmp_path)))


def put_profile(client: TestClient, s: Signed, body: dict[str, object]) -> int:
    return client.put(
        "/v1/me/profile", json={"birth_date": born(18), **body}, headers=s.headers
    ).status_code


def test_interests_are_kept_and_read_back(client: TestClient, adult: Signed, seeded: None) -> None:  # noqa: F811
    assert put_profile(client, adult, {"interests": ["it"]}) == 200
    assert client.get("/v1/me/details", headers=adult.headers).json()["interests"] == ["it"]


def test_saving_basics_keeps_earlier_interests(
    client: TestClient,
    adult: Signed,  # noqa: F811
    seeded: None,
) -> None:
    put_profile(client, adult, {"interests": ["it"]})
    put_profile(client, adult, {"first_name": "Thandi"})
    assert client.get("/v1/me/details", headers=adult.headers).json()["interests"] == ["it"]


def test_more_than_three_interests_are_refused(
    client: TestClient,
    adult: Signed,  # noqa: F811
    seeded: None,
) -> None:
    assert put_profile(client, adult, {"interests": ["it", "health", "law", "commerce"]}) == 422


def test_unknown_interest_is_refused(client: TestClient, adult: Signed, seeded: None) -> None:  # noqa: F811
    assert put_profile(client, adult, {"interests": ["astrology"]}) == 422


def test_saving_interests_keeps_province_and_certificate(
    client: TestClient,
    adult: Signed,  # noqa: F811
    seeded: None,
) -> None:
    put_profile(client, adult, {"province": "Gauteng", "certificate": "nsc"})
    put_profile(client, adult, {"interests": ["it"]})
    me = client.get("/v1/me/details", headers=adult.headers).json()
    assert me["interests"] == ["it"]
    assert put_profile(client, adult, {}) == 200
