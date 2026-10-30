"""Sign-in tokens.

Access tokens are short JWTs that name the user and nothing else (OWASP: meaningless
session values). The algorithm, issuer and audience are fixed here, never read from the
token. Refresh tokens are random, stored as a hash, and replaced on every use; the sign-in
ends at a fixed time however often it is renewed.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Identity
from app.errors import UnauthenticatedError

ISSUER = "edulift"
AUDIENCE = "edulift-api"
ALGORITHM = "HS256"
ACCESS_SECONDS = 15 * 60
SIGN_IN_HOURS = 8


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    expires_in: int
    refresh_token: str


def now() -> datetime:
    return datetime.now(UTC)


def access_token(secret: str, subject: str) -> str:
    issued = now()
    claims: dict[str, Any] = {
        "sub": subject,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": issued,
        "exp": issued + timedelta(seconds=ACCESS_SECONDS),
    }
    return jwt.encode(claims, secret, algorithm=ALGORITHM)


def check_access(secret: str, token: str) -> Identity:
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=[ALGORITHM],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as err:
        raise UnauthenticatedError from err
    subject = claims["sub"]
    if not isinstance(subject, str) or not subject:
        raise UnauthenticatedError
    return Identity(subject=subject)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def sign_in(db: Session, secret: str, user_id: str, ends_at: datetime | None = None) -> TokenSet:
    refresh = secrets.token_urlsafe(32)
    db.add(
        m.RefreshToken(
            token_hash=_hash(refresh),
            user_id=user_id,
            expires_at=ends_at or now() + timedelta(hours=SIGN_IN_HOURS),
        )
    )
    db.flush()
    return TokenSet(access_token(secret, user_id), ACCESS_SECONDS, refresh)


def renew(db: Session, secret: str, refresh: str) -> TokenSet:
    """A new token pair. The old refresh token stops working."""
    row = db.get(m.RefreshToken, _hash(refresh), with_for_update=True)
    if row is None or row.expires_at <= now():
        raise UnauthenticatedError
    db.delete(row)
    db.flush()
    return sign_in(db, secret, row.user_id, ends_at=row.expires_at)


def sign_out(db: Session, refresh: str) -> None:
    db.execute(delete(m.RefreshToken).where(m.RefreshToken.token_hash == _hash(refresh)))


def sign_out_everywhere(db: Session, user_id: str) -> None:
    db.execute(delete(m.RefreshToken).where(m.RefreshToken.user_id == user_id))
