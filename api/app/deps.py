from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app import models as m
from app import tokens
from app.assist import AskProvider, DraftProvider
from app.auth import Identity
from app.config import Settings
from app.db import transaction
from app.demo import demo_identity
from app.errors import NotAllowedError, UnauthenticatedError
from app.explain import ExplanationProvider

_bearer = HTTPBearer(auto_error=False)


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _engine(request: Request) -> Engine:
    engine: Engine = request.app.state.engine
    return engine


def _db(request: Request) -> Iterator[Session]:
    yield from transaction(request.app.state.sessions)


def _signed_in(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(_settings)],
) -> Identity:
    # Identity comes from the token only.
    if credentials is None:
        raise UnauthenticatedError
    if settings.demo_secret:
        demo = demo_identity(credentials.credentials, settings.demo_secret)
        if demo is not None:
            return demo
    return tokens.check_access(settings.auth_secret, credentials.credentials)


def _admin(
    me: Annotated[Identity, Depends(_signed_in)], db: Annotated[Session, Depends(_db)]
) -> Identity:
    # Read from the database on every call, so removing an admin takes effect at once.
    user = db.get(m.User, me.subject)
    if user is None or user.role != "admin" or user.deleted_at is not None:
        raise NotAllowedError
    return me


def client_ip(request: Request, settings: Annotated[Settings, Depends(_settings)]) -> str:
    # Trust only the entries our own proxies added.
    if settings.trusted_proxy_hops:
        forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",")]
        if len(forwarded) >= settings.trusted_proxy_hops:
            return forwarded[-settings.trusted_proxy_hops]
    return request.client.host if request.client else "unknown"


Db = Annotated[Session, Depends(_db)]
DbEngine = Annotated[Engine, Depends(_engine)]
SignedIn = Annotated[Identity, Depends(_signed_in)]
Admin = Annotated[Identity, Depends(_admin)]
ClientIp = Annotated[str, Depends(client_ip)]


def _explainer(request: Request) -> ExplanationProvider:
    provider: ExplanationProvider = request.app.state.explainer
    return provider


Explainer = Annotated[ExplanationProvider, Depends(_explainer)]


def _asker(request: Request) -> AskProvider:
    provider: AskProvider = request.app.state.asker
    return provider


def _drafter(request: Request) -> DraftProvider:
    provider: DraftProvider = request.app.state.drafter
    return provider


Asker = Annotated[AskProvider, Depends(_asker)]
Drafter = Annotated[DraftProvider, Depends(_drafter)]
AppSettings = Annotated[Settings, Depends(_settings)]
