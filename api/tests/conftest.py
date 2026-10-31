"""Tests run on real Postgres, built with our migrations."""

import os
import re
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
from app.main import create_app

TABLES = [
    "document_drafts",
    "ai_requests", "reminders_sent", "checklist_items", "applications", "saved_items",
    "plan_targets", "opportunities", "mark_records", "guardian_requests", "consents", "profiles",
    "credentials", "recovery_codes", "refresh_tokens",
    "users", "rate_limit_hits", "nbt_records", "fps_bands", "programme_requirements", "programmes",
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


AUTH_SECRET = "test-auth-secret-at-least-32-characters-long"
# Long, unrelated words: passes the strength rules.
PASSWORD = "copper lantern mango thunder"


@pytest.fixture
def inbox() -> dict[str, str]:
    # Kept so sign_in(client, inbox, email) reads as before; nothing is emailed any more.
    return {}


def make_client(engine: Engine, **overrides: object) -> TestClient:
    values: dict[str, object] = {
        "edulift_env": "test",
        "database_url": engine.url.render_as_string(hide_password=False),
        "auth_secret": AUTH_SECRET,
        "app_url": "http://localhost:8081",
        "_env_file": None,
    }
    settings = Settings(**(values | overrides))  # type: ignore[arg-type]
    app = create_app(settings, engine=engine)
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def client(engine: Engine) -> TestClient:
    return make_client(engine)


@dataclass(frozen=True)
class Session:
    access_token: str
    refresh_token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


def username_for(email: str) -> str:
    return re.sub(r"[^a-z0-9._]", ".", email.lower())[:30]


def sign_in(client: TestClient, _inbox: dict[str, str], email: str) -> Session:
    """Sign in as the learner named by this address, creating the account the first time."""
    body = {"username": username_for(email), "password": PASSWORD}
    reply = client.post("/v1/auth/register", json=body)
    if reply.status_code == 409:
        reply = client.post("/v1/auth/login", json=body)
    tokens = reply.json()
    return Session(tokens["access_token"], tokens["refresh_token"])
