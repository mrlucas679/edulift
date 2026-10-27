"""The "Try the demo" sign-in: a fresh, fake learner on every tap, no email.

It only works when DEMO_SECRET is set. Demo tokens are signed with that secret and only
name demo learners. Each tap gets its own learner, so two judges never share marks.
Turning the demo off is clearing DEMO_SECRET.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Identity

DEMO_PREFIX = "demo-"
DEMO_ISSUER = "edulift-demo"
DEMO_CLIENT = "demo"
DEMO_SECONDS = 4 * 60 * 60


def demo_token(secret: str, subject: str, now: datetime | None = None) -> str:
    issued = now or datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": subject,
        "iss": DEMO_ISSUER,
        "client_id": DEMO_CLIENT,
        "token_use": "access",
        "iat": issued,
        "exp": issued + timedelta(seconds=DEMO_SECONDS),
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def demo_identity(token: str, secret: str) -> Identity | None:
    """The demo learner's identity if the token is a valid demo token, else None."""
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=DEMO_ISSUER,
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.startswith(DEMO_PREFIX):
        return None
    if claims.get("client_id") != DEMO_CLIENT:
        return None
    return Identity(subject=subject)


def new_demo_learner(db: Session) -> str:
    """A brand-new learner who goes through the normal onboarding."""
    subject = f"{DEMO_PREFIX}{uuid.uuid4().hex}"
    db.add(m.User(id=subject, status="onboarding"))
    db.flush()
    return subject
