import logging

import pytest
from fastapi.testclient import TestClient

from app.logs import JsonFormatter
from tests.conftest import PASSWORD, sign_in, username_for


def test_unknown_route_uses_the_usual_error_shape(client: TestClient) -> None:
    response = client.get("/v1/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-Id"]


def test_bad_input_names_the_field_but_never_repeats_it(client: TestClient) -> None:
    response = client.post("/v1/auth/login", json={"username": "secret value xyz", "password": "p"})
    assert "username" in response.json()["error"]["message"]
    assert "secret-value-xyz" not in response.text


def test_security_headers_on_every_response(client: TestClient) -> None:
    headers = client.get("/v1/health").headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Cache-Control"] == "no-store"


def test_logs_never_contain_the_username_password_or_tokens(
    client: TestClient, inbox: dict[str, str], caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    email = "private.person@example.org"
    session = sign_in(client, inbox, email)
    client.get("/v1/me", headers=session.headers)
    client.post("/v1/auth/refresh", json={"refresh_token": session.refresh_token})

    logged = "\n".join(JsonFormatter().format(r) for r in caplog.records)
    for secret in (username_for(email), PASSWORD, session.access_token, session.refresh_token):
        assert secret not in logged
