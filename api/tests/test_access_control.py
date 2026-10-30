"""Who may call what (OWASP A01 broken access control; API5 function-level authorization)."""

import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session

from app import models as m
from app.jobs.admins import set_role
from tests.conftest import PASSWORD, sign_in, username_for

# Every route anyone may call without signing in. A new public route must be added here on
# purpose, so nothing becomes public by accident (OWASP API9: know your inventory).
PUBLIC = {
    "GET /v1/deadlines",
    "GET /v1/fields",
    "GET /v1/guardian/withdraw/{token}",
    "GET /v1/guardian/withdraw/{token}/export",
    "GET /v1/guardian/{token}",
    "GET /v1/handoffs",
    "GET /v1/health",
    "GET /v1/institutions",
    "GET /v1/institutions/{institution_id}",
    "GET /v1/meta",
    "GET /v1/opportunities",
    "GET /v1/opportunities/{opportunity_id}",
    "GET /v1/programmes",
    "GET /v1/programmes/{programme_id}",
    "GET /v1/subjects",
    "POST /v1/aps/preview",
    "POST /v1/auth/demo",
    "POST /v1/auth/login",
    "POST /v1/auth/recover",
    "POST /v1/auth/refresh",
    "POST /v1/auth/register",
    "POST /v1/guardian/withdraw/{token}",
    "POST /v1/guardian/{token}",
}


def routes(client: TestClient) -> list[tuple[str, str]]:
    paths = client.app.openapi()["paths"]  # type: ignore[attr-defined]
    return [(method.upper(), path) for path, ops in paths.items() for method in ops]


def test_only_the_listed_routes_are_public(client: TestClient) -> None:
    paths = client.app.openapi()["paths"]  # type: ignore[attr-defined]
    public = {
        f"{method.upper()} {path}"
        for path, ops in paths.items()
        for method, op in ops.items()
        if not op.get("security")
    }
    assert public == PUBLIC


def test_every_other_route_refuses_a_caller_without_a_token(client: TestClient) -> None:
    for method, path in routes(client):
        if f"{method} {path}" in PUBLIC:
            continue
        url = re.sub(r"\{[^}]+\}", "x", path)
        reply = client.request(method, url, json={})
        assert reply.status_code == 401, f"{method} {path} answered {reply.status_code}"


def make_admin(engine: Engine, email: str) -> None:
    with Session(engine) as db, db.begin():
        assert set_role(db, username_for(email), "admin")


def test_a_student_cannot_see_admin_pages(client: TestClient, inbox: dict[str, str]) -> None:
    student = sign_in(client, inbox, "student@example.org")
    assert client.get("/v1/admin/stats", headers=student.headers).status_code == 403


def test_an_admin_sees_totals_but_no_learner_details(
    client: TestClient, inbox: dict[str, str], engine: Engine
) -> None:
    sign_in(client, inbox, "zanele@example.org")
    sign_in(client, inbox, "boss@example.org")
    make_admin(engine, "boss@example.org")
    admin = sign_in(client, inbox, "boss@example.org")  # granting ended the old sign-in
    reply = client.get("/v1/admin/stats", headers=admin.headers)
    assert reply.status_code == 200
    assert reply.json()["accounts"] == 2
    assert "zanele" not in reply.text


def test_granting_admin_ends_every_sign_in(
    client: TestClient, inbox: dict[str, str], engine: Engine
) -> None:
    before = sign_in(client, inbox, "boss@example.org")
    make_admin(engine, "boss@example.org")
    renewed = client.post("/v1/auth/refresh", json={"refresh_token": before.refresh_token})
    assert renewed.status_code == 401


def test_removing_admin_takes_effect_at_once(
    client: TestClient, inbox: dict[str, str], engine: Engine
) -> None:
    sign_in(client, inbox, "boss@example.org")
    make_admin(engine, "boss@example.org")
    admin = sign_in(client, inbox, "boss@example.org")
    with Session(engine) as db, db.begin():
        db.execute(update(m.User).values(role="student"))
    # The same, still-valid access token is refused straight away.
    assert client.get("/v1/admin/stats", headers=admin.headers).status_code == 403


def test_nobody_can_make_themselves_admin_through_the_api(client: TestClient) -> None:
    body = {"username": "sneaky", "password": PASSWORD, "role": "admin"}
    assert client.post("/v1/auth/register", json=body).status_code == 422


@pytest.mark.parametrize("path", ["/v1/me/details", "/v1/me/marks", "/v1/me/export"])
def test_a_learner_only_ever_sees_their_own_data(
    client: TestClient, inbox: dict[str, str], path: str
) -> None:
    mine = sign_in(client, inbox, "mine@example.org")
    theirs = sign_in(client, inbox, "theirs@example.org")
    client.put(
        "/v1/me/profile",
        json={"first_name": "Uniquename", "birth_date": "2005-01-01"},
        headers=theirs.headers,
    )
    assert "Uniquename" not in client.get(path, headers=mine.headers).text
