"""Bookmarks for programmes and opportunities. Only the signed-in learner's own."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m
from app.deps import Db, SignedIn
from app.routers.marks import active_user
from app.tracking import target_summary

router = APIRouter(prefix="/me/saved", tags=["saved"])


class SavedIn(BaseModel):
    target_kind: Literal["programme", "opportunity"]
    target_id: str


class SavedOut(BaseModel):
    target_kind: str
    target_id: str
    name: str
    closes_on: date | None


def _out(db: Session, row: m.SavedItem) -> SavedOut:
    name, closes = target_summary(db, row.target_kind, row.target_id)
    return SavedOut(
        target_kind=row.target_kind,
        target_id=row.target_id,
        name=name,
        closes_on=closes,
    )


@router.get("")
def read(me: SignedIn, db: Db) -> list[SavedOut]:
    user = active_user(db, me.subject)
    rows = db.scalars(
        select(m.SavedItem).where(m.SavedItem.user_id == user.id).order_by(m.SavedItem.created_at)
    )
    return [_out(db, r) for r in rows]


@router.post("", status_code=201)
def add(body: SavedIn, me: SignedIn, db: Db) -> SavedOut:
    user = active_user(db, me.subject)
    target_summary(db, body.target_kind, body.target_id)  # refuses unknown targets
    existing = db.scalar(
        select(m.SavedItem).where(
            m.SavedItem.user_id == user.id,
            m.SavedItem.target_kind == body.target_kind,
            m.SavedItem.target_id == body.target_id,
        )
    )
    if existing is None:
        existing = m.SavedItem(
            user_id=user.id, target_kind=body.target_kind, target_id=body.target_id
        )
        db.add(existing)
        db.flush()
    return _out(db, existing)


@router.delete("/{target_kind}/{target_id}", status_code=204)
def remove(target_kind: str, target_id: str, me: SignedIn, db: Db) -> Response:
    user = active_user(db, me.subject)
    db.execute(
        delete(m.SavedItem).where(
            m.SavedItem.user_id == user.id,
            m.SavedItem.target_kind == target_kind,
            m.SavedItem.target_id == target_id,
        )
    )
    return Response(status_code=204)
