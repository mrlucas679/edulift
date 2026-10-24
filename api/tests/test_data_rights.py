from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session as DbSession

from app import models as m
from app.fake_auth import FakeAuth
from app.jobs.retention import erase_unanswered
from app.seed import read, write
from tests.test_marks import THANDI, active
from tests.test_seed import REPO_DATA, dataset


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


def count(engine: Engine, model: type[m.Base]) -> int:
    with DbSession(engine) as db:
        return db.scalar(select(func.count()).select_from(model)) or 0


def test_export_is_the_learners_own_data(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    a = active(client, inbox, "a@example.org")
    b = active(client, inbox, "b@example.org")
    client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=a.headers)
    client.put("/v1/me/marks/gr11_final", json={"marks": {"mathematics": 10}}, headers=b.headers)
    body = client.get("/v1/me/export", headers=a.headers).json()
    assert body["marks"] == {"gr11_final": THANDI}
    assert body["profile"]["birth_date"]
    assert "token" not in str(body).lower()


def test_export_needs_sign_in(client: TestClient, seeded: None) -> None:
    assert client.get("/v1/me/export").status_code == 401


def test_delete_removes_the_learner_and_keeps_an_audit_line(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    s = active(client, inbox, "a@example.org")
    client.put("/v1/me/marks/gr11_final", json={"marks": THANDI}, headers=s.headers)
    assert client.delete("/v1/me", headers=s.headers).status_code == 204
    assert count(engine, m.User) == 0
    assert count(engine, m.Mark) == 0
    with DbSession(engine) as db:
        actions = db.scalars(
            select(m.AuditEvent.action).where(m.AuditEvent.user_id.is_(None))
        ).all()
    assert "delete" in actions


def test_delete_needs_sign_in(client: TestClient, seeded: None) -> None:
    assert client.delete("/v1/me").status_code == 401


def test_retention_erases_unanswered_guardian_requests(
    seeded: None, engine: Engine, identity: FakeAuth
) -> None:
    old = datetime.now(UTC) - timedelta(days=8)
    with DbSession(engine) as db, db.begin():
        db.add(m.User(id="kid-1", status="pending_guardian"))
        db.flush()
        db.add(
            m.GuardianRequest(
                user_id="kid-1",
                guardian_name="Parent",
                guardian_email="parent@example.org",
                token_hash="h" * 64,
                expires_at=old,
                status="pending",
                created_at=old,
            )
        )
    with DbSession(engine) as db, db.begin():
        assert erase_unanswered(db, identity, datetime.now(UTC)) == 1
    assert count(engine, m.User) == 0


def test_recent_guardian_requests_are_kept(
    seeded: None, engine: Engine, identity: FakeAuth
) -> None:
    now = datetime.now(UTC)
    with DbSession(engine) as db, db.begin():
        db.add(m.User(id="kid-2", status="pending_guardian"))
        db.flush()
        db.add(
            m.GuardianRequest(
                user_id="kid-2",
                guardian_name="Parent",
                guardian_email="parent@example.org",
                token_hash="g" * 64,
                expires_at=now,
                status="pending",
                created_at=now,
            )
        )
    with DbSession(engine) as db, db.begin():
        assert erase_unanswered(db, identity, now) == 0
    assert count(engine, m.User) == 1
