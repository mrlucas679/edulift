from fastapi import APIRouter, Response

from app.db import database_up
from app.dependencies import DbEngine
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health(response: Response, engine: DbEngine) -> HealthResponse:
    if database_up(engine):
        return HealthResponse(status="ok", database="ok")
    response.status_code = 503
    return HealthResponse(status="degraded", database="unavailable")
