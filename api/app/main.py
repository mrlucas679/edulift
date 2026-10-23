"""Run with: uvicorn app.main:create_app --factory --no-access-log"""

import hmac
import logging
import time
from collections.abc import Awaitable, Callable

import boto3
from botocore.config import Config
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from app.auth import Auth
from app.config import Settings
from app.db import new_engine
from app.errors import add_handlers, error_response
from app.explain import BedrockProvider, ExplanationProvider, TemplateProvider
from app.identity import identity_for
from app.logs import setup_logging
from app.mail import Mailer, mailer_for
from app.request_id import new_id
from app.routers import (
    alternatives,
    applications,
    aps,
    auth,
    explain,
    health,
    marks,
    me,
    onboarding,
    opportunities,
    plan,
    reference,
    saved,
    verdicts,
)

log = logging.getLogger("edulift.request")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def _auth(settings: Settings) -> Auth:
    return identity_for(settings)


def _explainer(settings: Settings) -> ExplanationProvider:
    if settings.ai_enabled and settings.bedrock_model_id:
        client = boto3.client(
            "bedrock-runtime",
            region_name=settings.aws_region,
            config=Config(read_timeout=settings.ai_timeout_seconds, retries={"max_attempts": 1}),
        )
        return BedrockProvider(client, settings.bedrock_model_id)
    return TemplateProvider()


def _mailer(settings: Settings) -> Mailer:
    return mailer_for(settings)


def create_app(
    settings: Settings | None = None,
    identity: Auth | None = None,
    engine: Engine | None = None,
    mailer: Mailer | None = None,
    explainer: ExplanationProvider | None = None,
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
    app.state.explainer = explainer or _explainer(settings)

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
        saved.router,
        applications.router,
        explain.router,
    ):
        app.include_router(router, prefix="/v1")
    return app
