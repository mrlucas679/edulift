"""Saved marks. Only for active accounts, which means account consent is in place."""

from typing import Literal

from fastapi import APIRouter
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m
from app.accounts import ensure_account
from app.deps import Db, SignedIn
from app.errors import AppError
from app.routers.aps import UnknownSubjectError
from app.schemas import MarksIn

router = APIRouter(prefix="/me/marks", tags=["marks"])

Period = Literal["gr11_final", "gr12_june", "gr12_prelim", "gr12_final"]
NEWEST_FIRST: list[str] = ["gr12_final", "gr12_prelim", "gr12_june", "gr11_final"]


class NotActiveError(AppError):
    code = "consent_required"
    status_code = 403
    message = "Finish setting up your account before saving marks."


def active_user(db: Session, subject: str) -> m.User:
    user = ensure_account(db, subject)
    if user.status != "active":
        raise NotActiveError
    return user


def saved_marks(db: Session, user_id: str) -> dict[str, dict[str, int]]:
    rows = db.execute(
        select(m.Mark.period, m.Mark.subject_id, m.Mark.percent).where(m.Mark.user_id == user_id)
    )
    out: dict[str, dict[str, int]] = {}
    for period, subject, percent in rows:
        out.setdefault(period, {})[subject] = percent
    return out


def latest_marks(db: Session, user_id: str) -> dict[str, int] | None:
    by_period = saved_marks(db, user_id)
    newest = next((p for p in NEWEST_FIRST if p in by_period), None)
    return by_period[newest] if newest else None


@router.get("")
def read(me: SignedIn, db: Db) -> dict[str, dict[str, int]]:
    return saved_marks(db, active_user(db, me.subject).id)


@router.put("/{period}")
def save(period: Period, body: MarksIn, me: SignedIn, db: Db) -> dict[str, int]:
    user = active_user(db, me.subject)
    if unknown := sorted(set(body.marks) - set(db.scalars(select(m.Subject.id)))):
        raise UnknownSubjectError(f"Unknown subjects: {', '.join(unknown[:5])}")
    # Replace the whole period, so a removed subject really goes.
    db.execute(delete(m.Mark).where(m.Mark.user_id == user.id, m.Mark.period == period))
    db.add_all(
        m.Mark(user_id=user.id, period=period, subject_id=s, percent=p)
        for s, p in body.marks.items()
    )
    return body.marks
