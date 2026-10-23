"""Run with: uvicorn app.main:create_app --factory --no-access-log"""

import logging
import time
from collections.abc import Awaitable, Callable

import boto3
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from app.adapters.cognito_identity import CognitoIdentityProvider
from app.adapters.fake_identity import FakeIdentityProvider
from app.config import Settings
from app.db import make_engine
from app.errors import add_error_handlers
from app.identity import IdentityProvider
from app.logging_config import configure_logging
from app.request_id import new_request_id
from app.routers import auth, health, me

log = logging.getLogger("edulift.request")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def _identity_provider(settings: Settings) -> IdentityProvider:
    if settings.identity_provider == "cognito":
        return CognitoIdentityProvider(
            boto3.client("cognito-idp", region_name=settings.aws_region),
            user_pool_id=settings.cognito_user_pool_id,
            app_client_id=settings.cognito_app_client_id,
            region=settings.aws_region,
        )

    def print_code(_email: str, code: str) -> None:
        # Local only. The address stays out of the log on purpose.
        log.warning("local sign-in code: %s", code)

    return FakeIdentityProvider(send_code=print_code)


def create_app(
    settings: Settings | None = None,
    identity: IdentityProvider | None = None,
    engine: Engine | None = None,
) -> FastAPI:
    if settings is None:
        configure_logging()
        settings = Settings()  # reads the environment

    app = FastAPI(
        title="EduLift API",
        # No public API docs on the deployed service.
        docs_url=None if settings.deployed else "/docs",
        redoc_url=None,
        openapi_url=None if settings.deployed else "/openapi.json",
    )
    app.state.settings = settings
    app.state.engine = engine or make_engine(settings.database_url)
    app.state.sessions = sessionmaker(bind=app.state.engine, expire_on_commit=False)
    app.state.identity = identity or _identity_provider(settings)

    add_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Request-Id"],
    )

    @app.middleware("http")
    async def stamp_and_log(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = new_request_id()
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        response.headers.update(SECURITY_HEADERS)
        if settings.deployed:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        # Log the route template, not the raw path, so ids in URLs stay out of logs.
        route = getattr(request.scope.get("route"), "path", "unmatched")
        took_ms = round((time.perf_counter() - started) * 1000)
        log.info(
            "request",
            extra={
                "fields": {
                    "method": request.method,
                    "route": route,
                    "status": response.status_code,
                    "ms": took_ms,
                }
            },
        )
        return response

    for router in (health.router, auth.router, me.router):
        app.include_router(router, prefix="/v1")
    return app
