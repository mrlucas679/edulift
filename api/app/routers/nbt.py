"""NBT levels. Only with the optional nbt_results purpose, for active accounts."""

from typing import Literal

from fastapi import APIRouter
from sqlalchemy import delete, select

from app import models as m
from app.deps import Db, SignedIn
from app.errors import AppError
from app.routers.marks import active_user
from app.schemas import Request

router = APIRouter(prefix="/me/nbt", tags=["nbt"])

Component = Literal["AL", "QL", "MAT"]
Level = Literal["basic", "intermediate", "upper_intermediate", "proficient"]


class NoConsentError(AppError):
    code = "consent_required"
    status_code = 403
    message = "Turn on NBT results in your settings first."


class LevelIn(Request):
    level: Level


def _consented(db: Db, user_id: str) -> bool:
    return (
        db.scalar(
            select(m.Consent.id).where(
                m.Consent.user_id == user_id,
                m.Consent.purpose == "nbt_results",
                m.Consent.withdrawn_at.is_(None),
            )
        )
        is not None
    )


def _checked_user(db: Db, subject: str) -> m.User:
    user = active_user(db, subject)
    if not _consented(db, user.id):
        raise NoConsentError
    return user


@router.get("")
def read(me: SignedIn, db: Db) -> dict[str, str]:
    user = _checked_user(db, me.subject)
    rows = db.execute(
        select(m.NbtRecord.component, m.NbtRecord.level).where(m.NbtRecord.user_id == user.id)
    )
    return {component: level for component, level in rows}


@router.put("/{component}")
def save(component: Component, body: LevelIn, me: SignedIn, db: Db) -> dict[str, str]:
    user = _checked_user(db, me.subject)
    db.execute(
        delete(m.NbtRecord).where(
            m.NbtRecord.user_id == user.id, m.NbtRecord.component == component
        )
    )
    db.add(m.NbtRecord(user_id=user.id, component=component, level=body.level))
    return {component: body.level}


@router.delete("/{component}", status_code=204)
def remove(component: Component, me: SignedIn, db: Db) -> None:
    user = _checked_user(db, me.subject)
    db.execute(
        delete(m.NbtRecord).where(
            m.NbtRecord.user_id == user.id, m.NbtRecord.component == component
        )
    )
