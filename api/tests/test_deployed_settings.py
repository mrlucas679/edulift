import pytest
from sqlalchemy import Engine

from app.adapters.fake_identity import FakeIdentityProvider
from app.config import Settings
from tests.conftest import make_client

SECRET = "s" * 40


def test_requests_that_skip_cloudfront_are_refused(
    engine: Engine, identity: FakeIdentityProvider
) -> None:
    client = make_client(engine, identity, origin_secret=SECRET)
    body = {"email": "a@example.org"}

    assert client.post("/v1/auth/start", json=body).status_code == 403
    assert (
        client.post("/v1/auth/start", json=body, headers={"X-Origin-Secret": "x"}).status_code
        == 403
    )
    allowed = client.post("/v1/auth/start", json=body, headers={"X-Origin-Secret": SECRET})
    assert allowed.status_code == 200


def test_health_check_still_works_without_the_header(
    engine: Engine, identity: FakeIdentityProvider
) -> None:
    client = make_client(engine, identity, origin_secret=SECRET)
    assert client.get("/v1/health").status_code == 200


def test_demo_refuses_to_start_without_an_origin_secret() -> None:
    with pytest.raises(ValueError, match="ORIGIN_SECRET"):
        Settings(
            edulift_env="demo",
            identity_provider="cognito",
            aws_region="af-south-1",
            cognito_user_pool_id="pool",
            cognito_app_client_id="client",
            database_url="postgresql+psycopg://x@y/z",
            _env_file=None,
        )


def test_database_url_built_from_parts_escapes_the_password() -> None:
    settings = Settings(
        edulift_env="test",
        identity_provider="fake",
        db_host="db.internal",
        db_name="edulift",
        db_user="edulift",
        db_password="p@ss:w/rd#1",
        _env_file=None,
    )
    assert settings.sqlalchemy_url == (
        "postgresql+psycopg://edulift:p%40ss%3Aw%2Frd%231@db.internal:5432/edulift?sslmode=require"
    )


def test_a_database_is_required() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL"):
        Settings(edulift_env="test", identity_provider="fake", _env_file=None)
