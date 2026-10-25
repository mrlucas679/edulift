"""The "Try the demo" sign-in: one shared, fake learner, no email.

It only works when DEMO_SECRET is set. Demo tokens are signed with that secret and
accepted only for the demo learner's id. Turning the demo off is clearing DEMO_SECRET.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Identity

DEMO_SUBJECT = "demo-learner"
DEMO_ISSUER = "edulift-demo"
DEMO_CLIENT = "demo"
DEMO_SECONDS = 4 * 60 * 60


def demo_token(secret: str, now: datetime | None = None) -> str:
    issued = now or datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": DEMO_SUBJECT,
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
    if claims.get("sub") != DEMO_SUBJECT or claims.get("client_id") != DEMO_CLIENT:
        return None
    return Identity(subject=DEMO_SUBJECT)


def reset_demo_learner(db: Session) -> None:
    """Start the shared demo learner from scratch, as a brand-new account.

    Everyone who signs in as the demo goes through the normal onboarding and enters
    their own marks. Deleting the account removes its data (the foreign keys cascade).
    """
    db.execute(delete(m.User).where(m.User.id == DEMO_SUBJECT))
    db.flush()
    db.add(m.User(id=DEMO_SUBJECT, status="onboarding"))
    db.flush()
