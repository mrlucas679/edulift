from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.auth import Auth, Identity
from app.config import Settings
from app.db import transaction
from app.errors import UnauthenticatedError

_bearer = HTTPBearer(auto_error=False)


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _engine(request: Request) -> Engine:
    engine: Engine = request.app.state.engine
    return engine


def _auth(request: Request) -> Auth:
    provider: Auth = request.app.state.identity
    return provider


def _db(request: Request) -> Iterator[Session]:
    yield from transaction(request.app.state.sessions)


def _signed_in(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    provider: Annotated[Auth, Depends(_auth)],
) -> Identity:
    # Identity comes from the token only.
    if credentials is None:
        raise UnauthenticatedError
    return provider.check_token(credentials.credentials)


def client_ip(request: Request, settings: Annotated[Settings, Depends(_settings)]) -> str:
    # Trust only the entries our own proxies added.
    if settings.trusted_proxy_hops:
        forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",")]
        if len(forwarded) >= settings.trusted_proxy_hops:
            return forwarded[-settings.trusted_proxy_hops]
    return request.client.host if request.client else "unknown"


Db = Annotated[Session, Depends(_db)]
DbEngine = Annotated[Engine, Depends(_engine)]
Identities = Annotated[Auth, Depends(_auth)]
SignedIn = Annotated[Identity, Depends(_signed_in)]
ClientIp = Annotated[str, Depends(client_ip)]
