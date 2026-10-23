from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import transaction
from app.errors import UnauthenticatedError
from app.identity import Identity, IdentityProvider

_bearer = HTTPBearer(auto_error=False)


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _engine(request: Request) -> Engine:
    engine: Engine = request.app.state.engine
    return engine


def _identity_provider(request: Request) -> IdentityProvider:
    provider: IdentityProvider = request.app.state.identity
    return provider


def _db(request: Request) -> Iterator[Session]:
    yield from transaction(request.app.state.sessions)


def _signed_in(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    provider: Annotated[IdentityProvider, Depends(_identity_provider)],
) -> Identity:
    # The learner is whoever the token says, never whatever the request body claims.
    if credentials is None:
        raise UnauthenticatedError
    return provider.verify_access_token(credentials.credentials)


def client_ip(request: Request, settings: Annotated[Settings, Depends(_settings)]) -> str:
    # Each proxy appends the address it saw, so the client is `hops` entries from the
    # end. Anything further left was written by the caller and can't be trusted.
    if settings.trusted_proxy_hops:
        forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",")]
        if len(forwarded) >= settings.trusted_proxy_hops:
            return forwarded[-settings.trusted_proxy_hops]
    return request.client.host if request.client else "unknown"


Db = Annotated[Session, Depends(_db)]
DbEngine = Annotated[Engine, Depends(_engine)]
Identities = Annotated[IdentityProvider, Depends(_identity_provider)]
SignedIn = Annotated[Identity, Depends(_signed_in)]
ClientIp = Annotated[str, Depends(client_ip)]
