from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.config import Settings
from app.main import create_app
from tests.conftest import AUTH_SECRET


def test_healthy(client: TestClient) -> None:
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_says_so_when_the_database_is_down() -> None:
    nowhere = "postgresql+psycopg://nobody:nothing@127.0.0.1:1/none"
    settings = Settings(
        edulift_env="test", database_url=nowhere, auth_secret=AUTH_SECRET, _env_file=None
    )
    engine = create_engine(nowhere, connect_args={"connect_timeout": 1})
    app = create_app(settings, engine=engine)

    response = TestClient(app).get("/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}
