"""Tests run on real Postgres, built with our migrations."""

import os
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url

from app import rate_limit
from app.config import Settings
from app.fake_auth import FakeAuth
from app.mail import ConsoleMailer
from app.main import create_app

TABLES = [
    "plan_targets", "mark_records", "guardian_requests", "consents", "profiles",
    "users", "rate_limit_hits", "programme_requirements", "programmes",
    "application_cycles", "institutions", "handoffs", "subjects", "fields", "sources",
]  # fmt: skip
LOCAL_TEST_DB = "postgresql+psycopg://edulift:edulift_local_only@127.0.0.1:5433/edulift_test"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    url = make_url(os.environ.get("TEST_DATABASE_URL", LOCAL_TEST_DB))
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as db:
        db.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
        db.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()

    alembic = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    alembic.attributes["database_url"] = url.render_as_string(hide_password=False)
    command.upgrade(alembic, "head")

    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    # Rate limits count per fixed window; a test crossing a window edge would flake.
    monkeypatch.setattr(rate_limit, "now", lambda: datetime(2026, 10, 23, 12, 0, 30, tzinfo=UTC))


@pytest.fixture(autouse=True)
def empty_tables(engine: Engine) -> None:
    with engine.begin() as db:
        db.execute(text(f"TRUNCATE {', '.join(TABLES)}"))


@pytest.fixture
def inbox() -> dict[str, str]:
    # email -> latest code
    return {}


@pytest.fixture
def identity(inbox: dict[str, str]) -> FakeAuth:
    return FakeAuth(send_code=inbox.__setitem__)


def make_client(
    engine: Engine, identity: FakeAuth, mailer: ConsoleMailer | None = None, **overrides: object
) -> TestClient:
    values: dict[str, object] = {
        "edulift_env": "test",
        "database_url": engine.url.render_as_string(hide_password=False),
        "identity_provider": "fake",
        "app_url": "http://localhost:8081",
        "_env_file": None,
    }
    settings = Settings(**(values | overrides))  # type: ignore[arg-type]
    app = create_app(settings, identity=identity, engine=engine, mailer=mailer)
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def mailer() -> ConsoleMailer:
    return ConsoleMailer()


@pytest.fixture
def client(engine: Engine, identity: FakeAuth, mailer: ConsoleMailer) -> TestClient:
    return make_client(engine, identity, mailer)


@dataclass(frozen=True)
class Session:
    access_token: str
    refresh_token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


def sign_in(client: TestClient, inbox: dict[str, str], email: str) -> Session:
    session = client.post("/v1/auth/start", json={"email": email}).json()["session"]
    body = {"email": email, "code": inbox[email], "session": session}
    tokens = client.post("/v1/auth/verify", json=body).json()
    return Session(tokens["access_token"], tokens["refresh_token"])


def wrong_code(right: str) -> str:
    return "111111" if right == "000000" else "000000"
