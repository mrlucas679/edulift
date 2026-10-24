"""Run with: uvicorn app.main:create_app --factory --no-access-log"""

import hmac
import logging
import time
from collections.abc import Awaitable, Callable

import boto3
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from app.auth import Auth
from app.cognito import CognitoAuth
from app.config import Settings
from app.db import new_engine
from app.errors import add_handlers, error_response
from app.fake_auth import FakeAuth
from app.logs import setup_logging
from app.mail import ConsoleMailer, Mailer, SesMailer
from app.request_id import new_id
from app.routers import (
    alternatives,
    aps,
    auth,
    health,
    marks,
    me,
    onboarding,
    opportunities,
    plan,
    reference,
    verdicts,
)

log = logging.getLogger("edulift.request")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}
WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _has_body(request: Request) -> bool:
    return (
        int(request.headers.get("content-length", "0") or 0) > 0
        or "transfer-encoding" in request.headers
    )


def _is_json(request: Request) -> bool:
    return request.headers.get("content-type", "").split(";")[0].strip() == "application/json"


def _auth(settings: Settings) -> Auth:
    if settings.identity_provider == "cognito":
        return CognitoAuth(
            boto3.client("cognito-idp", region_name=settings.aws_region),
            user_pool_id=settings.cognito_user_pool_id,
            app_client_id=settings.cognito_app_client_id,
            region=settings.aws_region,
        )

    def print_code(_email: str, code: str) -> None:
        # Local only; no email in the log.
        log.warning("local sign-in code: %s", code)

    return FakeAuth(send_code=print_code)


def _mailer(settings: Settings) -> Mailer:
    if settings.identity_provider == "cognito":
        client = boto3.client("sesv2", region_name=settings.aws_region)
        return SesMailer(client, settings.sender_email)
    return ConsoleMailer()


def create_app(
    settings: Settings | None = None,
    identity: Auth | None = None,
    engine: Engine | None = None,
    mailer: Mailer | None = None,
) -> FastAPI:
    if settings is None:
        setup_logging()
        settings = Settings()  # reads the environment

    app = FastAPI(
        title="EduLift API",
        # No docs in demo.
        docs_url=None if settings.deployed else "/docs",
        redoc_url=None,
        openapi_url=None if settings.deployed else "/openapi.json",
    )
    app.state.settings = settings
    app.state.engine = engine or new_engine(settings.sqlalchemy_url)
    app.state.sessions = sessionmaker(bind=app.state.engine, expire_on_commit=False)
    app.state.identity = identity or _auth(settings)
    app.state.mailer = mailer or _mailer(settings)

    add_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Request-Id"],
    )

    @app.middleware("http")
    async def around_request(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = new_id()
        started = time.perf_counter()
        # Health checks come straight from the load balancer.
        if (
            settings.origin_secret
            and request.url.path != "/v1/health"
            and not hmac.compare_digest(
                request.headers.get("x-origin-secret", ""), settings.origin_secret
            )
        ):
            response: Response = error_response(403, "not_allowed", "That isn't allowed.")
        elif request.method in WRITE_METHODS and _has_body(request) and not _is_json(request):
            response = error_response(415, "unsupported_media_type", "Send JSON.")
        else:
            response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        response.headers.update(SECURITY_HEADERS)
        if settings.deployed:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        # Route template, not the raw path.
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

    for router in (
        health.router,
        auth.router,
        me.router,
        reference.router,
        aps.router,
        verdicts.router,
        onboarding.router,
        marks.router,
        plan.router,
        alternatives.router,
        opportunities.router,
    ):
        app.include_router(router, prefix="/v1")
    return app
