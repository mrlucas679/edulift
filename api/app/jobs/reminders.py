"""Daily: email learners 14 and 3 days before a saved or tracked item closes.

Only learners who granted the reminders purpose get anything, and each
(learner, item, threshold) is sent once.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.config import Settings
from app.db import new_engine
from app.mail import Mailer, mailer_for
from app.tracking import target_summary

THRESHOLDS = (14, 3)
log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Due:
    user_id: str
    target_kind: str
    target_id: str
    name: str
    threshold_days: int
    closes_on: date


def has_reminder_consent(db: Session, user_id: str) -> bool:
    return (
        db.scalar(
            select(m.Consent.id).where(
                m.Consent.user_id == user_id,
                m.Consent.purpose == "reminders",
                m.Consent.withdrawn_at.is_(None),
            )
        )
        is not None
    )


def _tracked(db: Session) -> set[tuple[str, str, str]]:
    saved = db.execute(select(m.SavedItem.user_id, m.SavedItem.target_kind, m.SavedItem.target_id))
    applied = db.execute(
        select(m.Application.user_id, m.Application.target_kind, m.Application.target_id)
    )
    return {(u, k, t) for u, k, t in [*saved, *applied]}


def due_reminders(db: Session, today: date) -> list[Due]:
    due: list[Due] = []
    consenting: dict[str, bool] = {}
    for user_id, kind, target_id in _tracked(db):
        if user_id not in consenting:
            consenting[user_id] = has_reminder_consent(db, user_id)
        if not consenting[user_id]:
            continue
        name, closes = target_summary(db, kind, target_id)
        if closes is None:
            continue
        days = (closes - today).days
        if days in THRESHOLDS and not _already_sent(db, user_id, kind, target_id, days):
            due.append(Due(user_id, kind, target_id, name, days, closes))
    return sorted(due, key=lambda d: (d.closes_on, d.user_id, d.target_id))


def _already_sent(db: Session, user_id: str, kind: str, target_id: str, days: int) -> bool:
    return (
        db.scalar(
            select(m.ReminderSent.id).where(
                m.ReminderSent.user_id == user_id,
                m.ReminderSent.target_kind == kind,
                m.ReminderSent.target_id == target_id,
                m.ReminderSent.threshold_days == days,
            )
        )
        is not None
    )


def send_due(
    db: Session,
    today: date,
    address_for: Callable[[str], str | None],
    mailer: Mailer,
) -> int:
    """Send every due reminder. Returns how many went out. No address means no email."""
    sent = 0
    for due in due_reminders(db, today):
        to = address_for(due.user_id)
        if to is None:
            continue
        subject = f"{due.name} closes in {due.threshold_days} days"
        body = (
            f"{due.name} closes on {due.closes_on.isoformat()}.\n"
            "Check the official site before the closing date. EduLift never submits for you."
        )
        mailer.send(to, subject, body)
        db.add(
            m.ReminderSent(
                user_id=due.user_id,
                target_kind=due.target_kind,
                target_id=due.target_id,
                threshold_days=due.threshold_days,
            )
        )
        db.flush()
        sent += 1
    return sent


def contact_address(db: Session, user_id: str) -> str | None:
    profile = db.get(m.Profile, user_id)
    return profile.contact_email if profile else None


def main() -> None:
    settings = Settings()
    engine = new_engine(settings.sqlalchemy_url)
    with Session(engine) as db, db.begin():
        sent = send_due(
            db, date.today(), lambda uid: contact_address(db, uid), mailer_for(settings)
        )
    log.info("reminders sent: %d", sent)


if __name__ == "__main__":
    main()
