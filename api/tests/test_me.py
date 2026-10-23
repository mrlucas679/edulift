import jwt
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.adapters.fake_identity import ISSUER, FakeIdentityProvider
from tests.conftest import sign_in


def test_needs_a_token(client: TestClient) -> None:
    response = client.get("/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


# Tokens are built here rather than pasted in, so the secret scanner has nothing to trip on.
CLAIMS = {"sub": "x", "iss": ISSUER, "token_use": "access", "exp": 4_102_444_800}


def test_token_signed_with_someone_elses_key_is_refused(client: TestClient) -> None:
    forged = jwt.encode(CLAIMS, "not-our-key-" * 4, algorithm="HS256")
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_unsigned_token_is_refused(client: TestClient) -> None:
    # alg=none with valid-looking claims: the oldest JWT trick there is.
    unsigned = jwt.encode(CLAIMS, key="", algorithm="none")
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {unsigned}"}).status_code == 401


def test_expired_token_is_refused(client: TestClient, identity: FakeIdentityProvider) -> None:
    expired = identity.expired_token_for("someone")
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_first_call_creates_the_account_and_later_calls_read_it(
    client: TestClient, inbox: dict[str, str], engine: Engine
) -> None:
    session = sign_in(client, inbox, "a@example.org")
    first = client.get("/v1/me", headers=session.headers)
    second = client.get("/v1/me", headers=session.headers)

    assert first.status_code == 200
    assert first.json() == second.json()
    assert first.json()["status"] == "onboarding"
    with engine.connect() as db:
        assert db.execute(text("SELECT count(*) FROM users")).scalar_one() == 1


def test_two_people_get_two_accounts(client: TestClient, inbox: dict[str, str]) -> None:
    a = sign_in(client, inbox, "a@example.org")
    b = sign_in(client, inbox, "b@example.org")
    assert (
        client.get("/v1/me", headers=a.headers).json()["id"]
        != client.get("/v1/me", headers=b.headers).json()["id"]
    )
