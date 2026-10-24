from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session as DbSession

from app import models as m
from app.jobs.reminders import due_reminders, send_due
from app.seed import read, write
from tests.conftest import Session as Signed
from tests.conftest import sign_in
from tests.test_marks import active
from tests.test_seed import REPO_DATA, dataset

PROGRAMME = {"target_kind": "programme", "target_id": "uj.bsc-it"}


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


def close_programme_on(engine: Engine, day: date) -> None:
    with DbSession(engine) as db, db.begin():
        db.get_one(m.Programme, "uj.bsc-it").closes_on = day


def start_application(client: TestClient, s: Signed) -> dict[str, Any]:
    body: dict[str, Any] = client.post(
        "/v1/me/applications", json=PROGRAMME, headers=s.headers
    ).json()
    return body


def test_saving_needs_an_active_account(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = sign_in(client, inbox, "new@example.org")
    r = client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers)
    assert r.json()["error"]["code"] == "consent_required"


def test_save_list_remove(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    assert client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers).status_code == 201
    assert client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers).status_code == 201
    listed = client.get("/v1/me/saved", headers=s.headers).json()
    assert [i["target_id"] for i in listed] == ["uj.bsc-it"]
    gone = client.delete("/v1/me/saved/programme/uj.bsc-it", headers=s.headers)
    assert gone.status_code == 204
    assert client.get("/v1/me/saved", headers=s.headers).json() == []


def test_unknown_target_is_refused(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    body = {"target_kind": "programme", "target_id": "nope"}
    assert client.post("/v1/me/saved", json=body, headers=s.headers).status_code == 404


def test_another_learners_saved_items_are_private(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    a = active(client, inbox, "a@example.org")
    b = active(client, inbox, "b@example.org")
    client.post("/v1/me/saved", json=PROGRAMME, headers=a.headers)
    assert client.get("/v1/me/saved", headers=b.headers).json() == []


def test_new_application_seeds_the_checklist(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.post("/v1/me/applications", json=PROGRAMME, headers=s.headers)
    assert r.status_code == 201
    assert r.json()["status"] == "planning"
    assert len(r.json()["checklist"]) == 5


def test_submitted_without_reference_is_flagged(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    app_id = start_application(client, s)["id"]
    r = client.patch(
        f"/v1/me/applications/{app_id}", json={"status": "submitted"}, headers=s.headers
    )
    assert r.json()["needs_reference"] is True
    r = client.patch(
        f"/v1/me/applications/{app_id}", json={"external_reference": "UJ-123"}, headers=s.headers
    )
    assert r.json()["needs_reference"] is False


def test_offer_deadline_within_a_week_is_highlighted(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    app_id = start_application(client, s)["id"]
    soon = (date.today() + timedelta(days=3)).isoformat()
    r = client.patch(
        f"/v1/me/applications/{app_id}", json={"offer_deadline": soon}, headers=s.headers
    )
    assert r.json()["deadline_soon"] is True


def test_ticking_a_document_persists(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    app = start_application(client, s)
    item_id = app["checklist"][0]["id"]
    client.patch(
        f"/v1/me/applications/{app['id']}/checklist/{item_id}?done=true", headers=s.headers
    )
    again = client.get(f"/v1/me/applications/{app['id']}", headers=s.headers).json()
    assert again["checklist"][0]["done"] is True


def test_another_learners_application_is_not_found(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    a = active(client, inbox, "a@example.org")
    b = active(client, inbox, "b@example.org")
    app_id = start_application(client, a)["id"]
    assert client.get(f"/v1/me/applications/{app_id}", headers=b.headers).status_code == 404
    patch = client.patch(f"/v1/me/applications/{app_id}", json={"notes": "x"}, headers=b.headers)
    assert patch.status_code == 404
    assert client.delete(f"/v1/me/applications/{app_id}", headers=b.headers).status_code == 404


def test_notes_are_capped(client: TestClient, inbox: dict[str, str], seeded: None) -> None:
    s = active(client, inbox, "a@example.org")
    app_id = start_application(client, s)["id"]
    r = client.patch(f"/v1/me/applications/{app_id}", json={"notes": "x" * 1001}, headers=s.headers)
    assert r.status_code == 422


class Outbox:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject))


def grant(client: TestClient, inbox: dict[str, str], email: str, purpose: str) -> None:
    s = sign_in(client, inbox, email)
    body: dict[str, object] = {"purpose": purpose, "granted": True}
    if purpose == "reminders":
        body["contact_email"] = email
    client.post("/v1/me/consents", json=body, headers=s.headers)


def test_reminder_goes_out_once_at_fourteen_days(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    s = active(client, inbox, "a@example.org")
    client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers)
    grant(client, inbox, "a@example.org", "reminders")
    close_programme_on(engine, date.today() + timedelta(days=14))
    outbox = Outbox()
    with DbSession(engine) as db, db.begin():
        assert send_due(db, date.today(), lambda _: "a@example.org", outbox) == 1
    with DbSession(engine) as db, db.begin():
        assert send_due(db, date.today(), lambda _: "a@example.org", outbox) == 0
    assert len(outbox.sent) == 1


def test_no_reminder_without_consent(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    s = active(client, inbox, "a@example.org")
    client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers)
    close_programme_on(engine, date.today() + timedelta(days=3))
    with DbSession(engine) as db:
        assert due_reminders(db, date.today()) == []


def test_withdrawn_consent_stops_reminders(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    s = active(client, inbox, "a@example.org")
    client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers)
    grant(client, inbox, "a@example.org", "reminders")
    client.post(
        "/v1/me/consents", json={"purpose": "reminders", "granted": False}, headers=s.headers
    )
    close_programme_on(engine, date.today() + timedelta(days=3))
    with DbSession(engine) as db:
        assert due_reminders(db, date.today()) == []


def test_no_address_means_no_email(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    s = active(client, inbox, "a@example.org")
    client.post("/v1/me/saved", json=PROGRAMME, headers=s.headers)
    grant(client, inbox, "a@example.org", "reminders")
    close_programme_on(engine, date.today() + timedelta(days=3))
    outbox = Outbox()
    with DbSession(engine) as db, db.begin():
        assert send_due(db, date.today(), lambda _: None, outbox) == 0
    assert outbox.sent == []


def test_reminder_needs_a_contact_email(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.post(
        "/v1/me/consents", json={"purpose": "reminders", "granted": True}, headers=s.headers
    )
    assert r.status_code == 403


def test_withdrawing_reminders_clears_the_contact_email(
    client: TestClient, inbox: dict[str, str], seeded: None, engine: Engine
) -> None:
    s = active(client, inbox, "a@example.org")
    grant(client, inbox, "a@example.org", "reminders")
    client.post(
        "/v1/me/consents", json={"purpose": "reminders", "granted": False}, headers=s.headers
    )
    with DbSession(engine) as db:
        user = db.scalars(select(m.User)).one()
        assert db.get_one(m.Profile, user.id).contact_email is None
