"""Daily: erase guardian requests nobody answered within 7 days, with the learner's pending data."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.auth import Auth
from app.config import Settings
from app.db import new_engine
from app.erasure import erase_learner
from app.identity import identity_for

log = logging.getLogger(__name__)
UNANSWERED_AFTER = timedelta(days=7)


def erase_unanswered(db: Session, identities: Auth, now: datetime) -> int:
    cutoff = now - UNANSWERED_AFTER
    stale = db.scalars(
        select(m.GuardianRequest).where(
            m.GuardianRequest.status == "pending", m.GuardianRequest.created_at < cutoff
        )
    ).all()
    erased = 0
    for request in stale:
        user = db.get(m.User, request.user_id)
        if user is None:
            continue
        erase_learner(db, identities, user, action="retention")
        erased += 1
    return erased


def main() -> None:
    settings = Settings()
    engine = new_engine(settings.sqlalchemy_url)
    with Session(engine) as db, db.begin():
        erased = erase_unanswered(db, identity_for(settings), datetime.now(UTC))
    log.info("retention: erased %d unanswered guardian requests", erased)


if __name__ == "__main__":
    main()
