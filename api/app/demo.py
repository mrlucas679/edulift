"""The "Try the demo" sign-in: one shared, fake learner, no email.

It only works when DEMO_SECRET is set. Demo tokens are signed with that secret and
accepted only for the demo learner's id. Turning the demo off is clearing DEMO_SECRET.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Identity

DEMO_SUBJECT = "demo-learner"
DEMO_ISSUER = "edulift-demo"
DEMO_CLIENT = "demo"
DEMO_SECONDS = 4 * 60 * 60
DEMO_MARKS = {
    "english_hl": 72, "mathematics": 68, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip
POLICY = "2026-10"


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


def ensure_demo_learner(db: Session) -> None:
    """Create the demo learner with fake, complete data. Safe to call on every demo sign-in."""
    user = db.get(m.User, DEMO_SUBJECT)
    if user is None:
        user = m.User(id=DEMO_SUBJECT, status="active")
        db.add(user)
        db.flush()
    if db.get(m.Profile, DEMO_SUBJECT) is None:
        db.add(
            m.Profile(
                user_id=DEMO_SUBJECT,
                first_name="Demo",
                birth_date=datetime(2005, 3, 1, tzinfo=UTC).date(),
                province="Gauteng",
                certificate="nsc",
                interests=["it"],
            )
        )
        db.add(
            m.Consent(
                user_id=DEMO_SUBJECT, purpose="account", granted_by="learner", policy_version=POLICY
            )
        )
        db.flush()
    if db.query(m.Mark).filter(m.Mark.user_id == DEMO_SUBJECT).count() == 0:
        db.add_all(
            m.Mark(user_id=DEMO_SUBJECT, period="gr12_june", subject_id=s, percent=p)
            for s, p in DEMO_MARKS.items()
        )
