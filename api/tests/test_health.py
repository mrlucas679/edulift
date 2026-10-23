from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.adapters.fake_identity import FakeIdentityProvider
from app.config import Settings
from app.main import create_app


def test_healthy(client: TestClient) -> None:
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_says_so_when_the_database_is_down() -> None:
    nowhere = "postgresql+psycopg://nobody:nothing@127.0.0.1:1/none"
    settings = Settings(
        edulift_env="test", database_url=nowhere, identity_provider="fake", _env_file=None
    )
    engine = create_engine(nowhere, connect_args={"connect_timeout": 1})
    identity = FakeIdentityProvider(send_code=lambda *_: None)
    app = create_app(settings, identity=identity, engine=engine)

    response = TestClient(app).get("/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}


def test_fake_sign_in_is_refused_in_demo() -> None:
    try:
        Settings(edulift_env="demo", database_url="x", identity_provider="fake", _env_file=None)
    except ValueError:
        return
    raise AssertionError("demo accepted the fake identity provider")
