from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.fake_auth import FakeAuth
from tests.conftest import make_client, sign_in, wrong_code


def test_start_emails_a_code(client: TestClient, inbox: dict[str, str]) -> None:
    response = client.post("/v1/auth/start", json={"email": "Thandi@Example.org"})
    assert response.status_code == 200
    assert response.json()["session"]
    assert "thandi@example.org" in inbox  # stored lower-case


def test_start_rejects_a_bad_email(client: TestClient) -> None:
    response = client.post("/v1/auth/start", json={"email": "not-an-email"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_start_rejects_extra_fields(client: TestClient) -> None:
    response = client.post("/v1/auth/start", json={"email": "a@example.org", "role": "admin"})
    assert response.status_code == 422


def test_right_code_gives_tokens(client: TestClient, inbox: dict[str, str]) -> None:
    session = sign_in(client, inbox, "a@example.org")
    assert session.access_token
    assert session.refresh_token


def test_wrong_code_is_refused(client: TestClient, inbox: dict[str, str]) -> None:
    session = client.post("/v1/auth/start", json={"email": "a@example.org"}).json()["session"]
    body = {
        "email": "a@example.org",
        "code": wrong_code(inbox["a@example.org"]),
        "session": session,
    }
    response = client.post("/v1/auth/verify", json=body)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


def test_three_wrong_codes_and_even_the_right_one_stops_working(
    client: TestClient, inbox: dict[str, str]
) -> None:
    session = client.post("/v1/auth/start", json={"email": "a@example.org"}).json()["session"]
    right = inbox["a@example.org"]
    body = {"email": "a@example.org", "code": wrong_code(right), "session": session}
    errors = [client.post("/v1/auth/verify", json=body).json()["error"]["code"] for _ in range(3)]
    assert errors == ["invalid_code", "invalid_code", "code_expired"]

    body["code"] = right
    assert client.post("/v1/auth/verify", json=body).json()["error"]["code"] == "code_expired"


def test_a_code_only_works_for_the_address_it_was_sent_to(
    client: TestClient, inbox: dict[str, str]
) -> None:
    session = client.post("/v1/auth/start", json={"email": "a@example.org"}).json()["session"]
    body = {"email": "attacker@example.org", "code": inbox["a@example.org"], "session": session}
    assert client.post("/v1/auth/verify", json=body).status_code == 400


def test_code_must_be_six_digits(client: TestClient) -> None:
    body = {"email": "a@example.org", "code": "12ab", "session": "s"}
    assert client.post("/v1/auth/verify", json=body).status_code == 422


def test_refresh_gives_a_working_access_token(client: TestClient, inbox: dict[str, str]) -> None:
    session = sign_in(client, inbox, "a@example.org")
    fresh = client.post("/v1/auth/refresh", json={"refresh_token": session.refresh_token})
    assert fresh.status_code == 200
    headers = {"Authorization": f"Bearer {fresh.json()['access_token']}"}
    assert client.get("/v1/me", headers=headers).status_code == 200


def test_sign_out_kills_the_refresh_token(client: TestClient, inbox: dict[str, str]) -> None:
    session = sign_in(client, inbox, "a@example.org")
    body = {"refresh_token": session.refresh_token}
    assert client.post("/v1/auth/sign-out", json=body, headers=session.headers).status_code == 204
    assert client.post("/v1/auth/refresh", json=body).status_code == 401


def test_sign_out_needs_a_signed_in_caller(client: TestClient) -> None:
    response = client.post("/v1/auth/sign-out", json={"refresh_token": "anything"})
    assert response.status_code == 401


def test_one_address_cannot_be_sent_more_than_five_codes(client: TestClient) -> None:
    statuses = [
        client.post("/v1/auth/start", json={"email": "victim@example.org"}).status_code
        for _ in range(6)
    ]
    assert statuses == [200] * 5 + [429]


def test_one_machine_cannot_cycle_through_addresses(client: TestClient) -> None:
    statuses = [
        client.post("/v1/auth/start", json={"email": f"user{n}@example.org"}).status_code
        for n in range(31)
    ]
    assert statuses[:30] == [200] * 30
    assert statuses[30] == 429


def test_spoofed_forwarded_for_does_not_dodge_the_limit(engine: Engine, identity: FakeAuth) -> None:
    # Behind CloudFront and the load balancer there are two trusted hops. Whatever the
    # caller writes at the front of the header must not change who we think they are.
    client = make_client(engine, identity, trusted_proxy_hops=2)
    statuses = []
    for n in range(31):
        headers = {"X-Forwarded-For": f"10.0.0.{n}, 196.1.2.3, 13.0.0.1"}
        body = {"email": f"user{n}@example.org"}
        statuses.append(client.post("/v1/auth/start", json=body, headers=headers).status_code)
    assert statuses[-1] == 429
