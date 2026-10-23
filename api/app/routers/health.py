from fastapi import APIRouter, Response

from app.db import db_ok
from app.deps import DbEngine
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health(response: Response, engine: DbEngine) -> HealthResponse:
    if db_ok(engine):
        return HealthResponse(status="ok", database="ok")
    response.status_code = 503
    return HealthResponse(status="degraded", database="unavailable")
