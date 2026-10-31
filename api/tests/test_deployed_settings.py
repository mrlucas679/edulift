import pytest
from sqlalchemy import Engine

from app.config import Settings
from app.mail import NoMailer, mailer_for
from tests.conftest import AUTH_SECRET, PASSWORD, make_client

SECRET = "s" * 40
DB = "postgresql+psycopg://x@y/z"


def test_requests_that_skip_cloudfront_are_sent_back_to_it(engine: Engine) -> None:
    client = make_client(engine, origin_secret=SECRET)
    body = {"username": "thabo", "password": PASSWORD}

    for headers in ({}, {"X-Origin-Secret": "x"}):
        r = client.post("/v1/auth/login", json=body, headers=headers, follow_redirects=False)
        assert r.status_code == 308
        assert r.headers["location"] == "http://localhost:8081/v1/auth/login"
    # A path that looks like another host still stays on ours.
    r = client.get("//evil.example/x", follow_redirects=False)
    assert r.headers["location"].startswith("http://localhost:8081/")
    allowed = client.post("/v1/auth/register", json=body, headers={"X-Origin-Secret": SECRET})
    assert allowed.status_code == 201


def test_health_check_still_works_without_the_header(engine: Engine) -> None:
    client = make_client(engine, origin_secret=SECRET)
    assert client.get("/v1/health").status_code == 200


def test_demo_refuses_to_start_without_an_origin_secret() -> None:
    with pytest.raises(ValueError, match="ORIGIN_SECRET"):
        Settings(edulift_env="demo", auth_secret=AUTH_SECRET, database_url=DB, _env_file=None)


@pytest.mark.parametrize("secret", ["", "short"])
def test_a_strong_auth_secret_is_required(secret: str) -> None:
    with pytest.raises(ValueError, match="AUTH_SECRET"):
        Settings(edulift_env="test", auth_secret=secret, database_url=DB, _env_file=None)


def test_database_url_built_from_parts_escapes_the_password() -> None:
    settings = Settings(
        edulift_env="test",
        auth_secret=AUTH_SECRET,
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
        Settings(edulift_env="test", auth_secret=AUTH_SECRET, _env_file=None)


def test_demo_needs_an_https_link() -> None:
    with pytest.raises(ValueError, match="APP_URL"):
        Settings(
            edulift_env="demo",
            auth_secret=AUTH_SECRET,
            database_url=DB,
            origin_secret=SECRET,
            app_url="http://example.org",
            _env_file=None,
        )


def test_without_a_sender_aws_sends_no_email_rather_than_logging_it() -> None:
    settings = Settings(
        edulift_env="demo",
        auth_secret=AUTH_SECRET,
        database_url=DB,
        origin_secret=SECRET,
        _env_file=None,
    )
    assert isinstance(mailer_for(settings), NoMailer)


def test_without_an_app_url_direct_requests_are_refused(engine: Engine) -> None:
    client = make_client(engine, origin_secret=SECRET, app_url="")
    assert client.get("/v1/institutions", follow_redirects=False).status_code == 403
