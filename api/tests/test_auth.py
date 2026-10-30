from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Engine, text

from app import tokens
from tests.conftest import AUTH_SECRET, PASSWORD, make_client

NEW = "violet harbour quilt saddle"


def register(client: TestClient, username: str = "thabo", **extra: object) -> dict[str, object]:
    reply = client.post(
        "/v1/auth/register", json={"username": username, "password": PASSWORD} | extra
    )
    assert reply.status_code == 201, reply.text
    body: dict[str, object] = reply.json()
    return body


def bearer(token: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login(client: TestClient, username: str = "thabo", password: str = PASSWORD) -> Response:
    return client.post("/v1/auth/login", json={"username": username, "password": password})


def test_register_signs_in_and_gives_ten_recovery_codes(client: TestClient) -> None:
    body = register(client)
    codes = body["recovery_codes"]
    assert isinstance(codes, list) and len(codes) == 10 and len(set(codes)) == 10
    assert client.get("/v1/me", headers=bearer(body["access_token"])).status_code == 200


def test_only_hashes_are_stored(client: TestClient, engine: Engine) -> None:
    body = register(client)
    with engine.connect() as db:
        stored = db.execute(text("SELECT password_hash FROM credentials")).scalar_one()
        code_hashes = set(db.execute(text("SELECT code_hash FROM recovery_codes")).scalars())
        refresh_hashes = set(db.execute(text("SELECT token_hash FROM refresh_tokens")).scalars())
    assert stored.startswith("$argon2id$") and PASSWORD not in stored
    assert not code_hashes & set(body["recovery_codes"])  # type: ignore[arg-type]
    assert body["refresh_token"] not in refresh_hashes


def test_usernames_are_one_per_person_whatever_the_case(client: TestClient) -> None:
    register(client, "Thabo")
    reply = client.post("/v1/auth/register", json={"username": "THABO", "password": PASSWORD})
    assert reply.status_code == 409
    assert reply.json()["error"]["code"] == "username_taken"


@pytest.mark.parametrize("username", ["ab", "a" * 31, "thabo!", "tha bo", "<script>", "émile"])
def test_bad_usernames_are_refused(client: TestClient, username: str) -> None:
    reply = client.post("/v1/auth/register", json={"username": username, "password": PASSWORD})
    assert reply.status_code == 422


@pytest.mark.parametrize(
    "password",
    ["short words", "passwordpassword123", "iloveyou12345678", "thabo is my name ok"],
)
def test_weak_or_guessable_passwords_are_refused_with_a_reason(
    client: TestClient, password: str
) -> None:
    reply = client.post("/v1/auth/register", json={"username": "thabo", "password": password})
    assert reply.status_code == 422
    assert reply.json()["error"]["code"] == "weak_password"
    assert reply.json()["error"]["message"]


def test_extra_fields_like_role_are_refused(client: TestClient) -> None:
    body = {"username": "thabo", "password": PASSWORD, "role": "admin"}
    assert client.post("/v1/auth/register", json=body).status_code == 422


def test_login_works_with_any_case_of_the_username(client: TestClient) -> None:
    register(client)
    assert login(client, "THABO").status_code == 200


def test_wrong_password_and_unknown_user_get_the_same_answer(client: TestClient) -> None:
    register(client)
    wrong = login(client, password="not the right password here")
    unknown = login(client, username="nobody")
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]


def test_guessing_one_username_is_slowed_down(client: TestClient) -> None:
    register(client)
    statuses = [login(client, password=f"guess number {n}").status_code for n in range(11)]
    assert statuses[:10] == [400] * 10
    assert statuses[10] == 429


def test_refresh_gives_new_tokens_and_the_old_refresh_stops_working(client: TestClient) -> None:
    body = register(client)
    first = client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert first.status_code == 200
    again = client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert again.status_code == 401
    assert client.get("/v1/me", headers=bearer(first.json()["access_token"])).status_code == 200


def test_renewing_never_extends_the_sign_in(client: TestClient, engine: Engine) -> None:
    body = register(client)
    with engine.connect() as db:
        before = db.execute(text("SELECT expires_at FROM refresh_tokens")).scalar_one()
    client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    with engine.connect() as db:
        after = db.execute(text("SELECT expires_at FROM refresh_tokens")).scalar_one()
    assert after == before


def test_web_sign_in_keeps_the_refresh_token_in_an_httponly_cookie(client: TestClient) -> None:
    body = register(client, use_cookie=True)
    assert body["refresh_token"] is None
    cookie = client.cookies.get("edulift_refresh")
    assert cookie
    renewed = client.post("/v1/auth/refresh", json={"use_cookie": True})
    assert renewed.status_code == 200
    header = renewed.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=strict" in header


def test_sign_out_ends_the_refresh_token(client: TestClient) -> None:
    body = register(client)
    reply = client.post(
        "/v1/auth/sign-out",
        json={"refresh_token": body["refresh_token"]},
        headers=bearer(body["access_token"]),
    )
    assert reply.status_code == 204
    assert (
        client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}).status_code
        == 401
    )


def test_a_recovery_code_sets_a_new_password_once(client: TestClient) -> None:
    body = register(client)
    code = body["recovery_codes"][0]  # type: ignore[index]
    reply = client.post(
        "/v1/auth/recover", json={"username": "thabo", "code": code, "new_password": NEW}
    )
    assert reply.status_code == 200
    assert login(client).status_code == 400
    assert login(client, password=NEW).status_code == 200
    reused = client.post(
        "/v1/auth/recover", json={"username": "thabo", "code": code, "new_password": NEW}
    )
    assert reused.status_code == 400


def test_recovery_ends_every_old_sign_in(client: TestClient) -> None:
    body = register(client)
    client.post(
        "/v1/auth/recover",
        json={"username": "thabo", "code": body["recovery_codes"][0], "new_password": NEW},  # type: ignore[index]
    )
    assert (
        client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}).status_code
        == 401
    )


def test_a_code_only_works_for_its_own_account(client: TestClient) -> None:
    mine = register(client, "thabo")
    register(client, "lerato")
    reply = client.post(
        "/v1/auth/recover",
        json={"username": "lerato", "code": mine["recovery_codes"][0], "new_password": NEW},  # type: ignore[index]
    )
    assert reply.status_code == 400
    assert login(client, "lerato").status_code == 200


def test_codes_can_be_typed_in_lower_case_without_dashes(client: TestClient) -> None:
    body = register(client)
    code = str(body["recovery_codes"][0]).lower().replace("-", " ")  # type: ignore[index]
    reply = client.post(
        "/v1/auth/recover", json={"username": "thabo", "code": code, "new_password": NEW}
    )
    assert reply.status_code == 200


def test_changing_the_password_needs_the_current_one(client: TestClient) -> None:
    body = register(client)
    wrong = client.post(
        "/v1/auth/password",
        json={"current_password": "not my password at all", "new_password": NEW},
        headers=bearer(body["access_token"]),
    )
    assert wrong.status_code == 400
    right = client.post(
        "/v1/auth/password",
        json={"current_password": PASSWORD, "new_password": NEW},
        headers=bearer(body["access_token"]),
    )
    assert right.status_code == 200
    assert login(client, password=NEW).status_code == 200
    assert (
        client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}).status_code
        == 401
    )


def test_new_recovery_codes_replace_the_old_ones(client: TestClient) -> None:
    body = register(client)
    reply = client.post(
        "/v1/auth/recovery-codes",
        json={"current_password": PASSWORD},
        headers=bearer(body["access_token"]),
    )
    assert reply.status_code == 200
    old = client.post(
        "/v1/auth/recover",
        json={"username": "thabo", "code": body["recovery_codes"][0], "new_password": NEW},  # type: ignore[index]
    )
    assert old.status_code == 400


def _token(**changes: object) -> str:
    now = datetime.now(UTC)
    claims: dict[str, object] = {
        "sub": "someone",
        "iss": tokens.ISSUER,
        "aud": tokens.AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=5),
    } | changes
    return jwt.encode(claims, AUTH_SECRET, algorithm="HS256")


@pytest.mark.parametrize(
    "token",
    [
        _token(exp=datetime.now(UTC) - timedelta(seconds=1)),
        _token(iss="someone-else"),
        _token(aud="another-api"),
        jwt.encode({"sub": "someone"}, AUTH_SECRET, algorithm="HS256"),
        jwt.encode(
            {"sub": "someone", "iss": tokens.ISSUER, "aud": tokens.AUDIENCE},
            "wrong-secret-of-at-least-32-chars!",
        ),
        jwt.encode(
            {"sub": "someone", "iss": tokens.ISSUER, "aud": tokens.AUDIENCE}, None, algorithm="none"
        ),
        "not-a-token",
    ],
)
def test_bad_tokens_are_refused(client: TestClient, token: str) -> None:
    assert client.get("/v1/me", headers=bearer(token)).status_code == 401


def test_spoofed_forwarded_for_does_not_dodge_the_limit(engine: Engine) -> None:
    # Behind CloudFront and the load balancer there are two trusted hops. Whatever the
    # caller writes at the front of the header must not change who we think they are.
    client = make_client(engine, trusted_proxy_hops=2)
    statuses = []
    for n in range(31):
        headers = {"X-Forwarded-For": f"10.0.0.{n}, 196.1.2.3, 13.0.0.1"}
        body = {"username": f"user{n}", "password": "wrong but long enough"}
        statuses.append(client.post("/v1/auth/login", json=body, headers=headers).status_code)
    assert statuses[-1] == 429
