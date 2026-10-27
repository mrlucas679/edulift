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

from app.assist import (
    AskProvider,
    BedrockAsk,
    BedrockDraft,
    DraftProvider,
    TemplateAsk,
    TemplateDraft,
)
from app.auth import Auth
from app.bedrock import FallbackClient
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
    assist,
    auth,
    explain,
    health,
    marks,
    me,
    nbt,
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


def _skipped_cloudfront(request: Request, app_url: str) -> Response:
    """A request that came round CloudFront goes back to it.

    A 308 (RFC 9110 15.4.9) names the API's real address and isn't an error, so a scanner
    probing the load balancer can't trip the deploy rollback alarm, which counts 4xx.
    Only the path is kept, and the host is always ours.
    """
    if not app_url:
        return error_response(403, "not_allowed", "That isn't allowed.")
    return Response(status_code=308, headers={"Location": app_url.rstrip("/") + request.url.path})


def _auth(settings: Settings) -> Auth:
    return identity_for(settings)


def _explainer(settings: Settings) -> ExplanationProvider:
    client = _ai_client(settings)
    if client is None:
        return TemplateProvider()
    return BedrockProvider(client, settings.bedrock_model_id)


def _ai_client(settings: Settings) -> object | None:
    if not (settings.ai_enabled and settings.bedrock_model_id):
        return None
    client = boto3.client(
        "bedrock-runtime",
        region_name=settings.aws_region,
        config=Config(read_timeout=settings.ai_timeout_seconds, retries={"max_attempts": 1}),
    )
    return FallbackClient(client, settings.bedrock_fallback_model_id)


def _asker(settings: Settings) -> AskProvider:
    client = _ai_client(settings)
    return BedrockAsk(client, settings.bedrock_model_id) if client else TemplateAsk()


def _drafter(settings: Settings) -> DraftProvider:
    client = _ai_client(settings)
    return BedrockDraft(client, settings.bedrock_model_id) if client else TemplateDraft()


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
    app.state.asker = _asker(settings)
    app.state.drafter = _drafter(settings)

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
            response: Response = _skipped_cloudfront(request, settings.app_url)
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
        nbt.router,
        plan.router,
        alternatives.router,
        opportunities.router,
        saved.router,
        applications.router,
        explain.router,
        assist.router,
    ):
        app.include_router(router, prefix="/v1")
    return app
