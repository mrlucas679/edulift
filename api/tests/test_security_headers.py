from fastapi.testclient import TestClient


def test_responses_carry_the_security_headers(client: TestClient) -> None:
    r = client.get("/v1/health")
    assert r.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert "camera=()" in r.headers["Permissions-Policy"]


def test_a_write_must_be_json(client: TestClient) -> None:
    r = client.post(
        "/v1/auth/start", content=b"email=a@example.org", headers={"Content-Type": "text/plain"}
    )
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_media_type"


def test_json_writes_pass_the_content_type_check(client: TestClient) -> None:
    r = client.post("/v1/auth/start", json={"email": "a@example.org"})
    assert r.status_code != 415
