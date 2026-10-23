from datetime import date
from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m
from app.deps import Db, SignedIn
from app.errors import NotFoundError
from app.routers.marks import active_user
from app.tracking import (
    DEFAULT_CHECKLIST,
    deadline_soon,
    needs_reference,
    official_url,
    target_summary,
)

router = APIRouter(prefix="/me/applications", tags=["applications"])

Status = Literal["planning", "submitted", "offer", "waitlist", "declined", "withdrawn"]


class ApplicationIn(BaseModel):
    target_kind: Literal["programme", "opportunity"]
    target_id: str = Field(min_length=1, max_length=80)


class ApplicationPatch(BaseModel):
    status: Status | None = None
    external_reference: str | None = Field(default=None, max_length=60)
    submitted_on: date | None = None
    offer_deadline: date | None = None
    notes: str | None = Field(default=None, max_length=1000)


class ChecklistOut(BaseModel):
    id: int
    label: str
    done: bool


class ApplicationOut(BaseModel):
    id: int
    target_kind: str
    target_id: str
    name: str
    status: str
    external_reference: str | None
    submitted_on: date | None
    offer_deadline: date | None
    notes: str
    apply_url: str  # the official site, shown before the learner leaves the app
    needs_reference: bool  # submitted without a reference number
    deadline_soon: bool  # offer deadline within a week
    checklist: list[ChecklistOut]


def _out(db: Session, app: m.Application, today: date) -> ApplicationOut:
    name, _ = target_summary(db, app.target_kind, app.target_id)
    items = db.scalars(
        select(m.ChecklistItem)
        .where(m.ChecklistItem.application_id == app.id)
        .order_by(m.ChecklistItem.sort_order)
    )
    return ApplicationOut(
        id=app.id,
        target_kind=app.target_kind,
        target_id=app.target_id,
        name=name,
        status=app.status,
        external_reference=app.external_reference,
        submitted_on=app.submitted_on,
        offer_deadline=app.offer_deadline,
        notes=app.notes,
        apply_url=official_url(db, app.target_kind, app.target_id),
        needs_reference=needs_reference(app),
        deadline_soon=deadline_soon(app, today),
        checklist=[ChecklistOut(id=i.id, label=i.label, done=i.done) for i in items],
    )


def _own(db: Session, user_id: str, application_id: int) -> m.Application:
    app = db.scalar(
        select(m.Application).where(
            m.Application.id == application_id, m.Application.user_id == user_id
        )
    )
    if app is None:
        raise NotFoundError
    return app


@router.get("")
def read(me: SignedIn, db: Db) -> list[ApplicationOut]:
    user = active_user(db, me.subject)
    today = date.today()
    rows = db.scalars(
        select(m.Application).where(m.Application.user_id == user.id).order_by(m.Application.id)
    )
    return [_out(db, r, today) for r in rows]


@router.post("", status_code=201)
def create(body: ApplicationIn, me: SignedIn, db: Db) -> ApplicationOut:
    user = active_user(db, me.subject)
    target_summary(db, body.target_kind, body.target_id)
    app = m.Application(user_id=user.id, target_kind=body.target_kind, target_id=body.target_id)
    db.add(app)
    db.flush()
    db.add_all(
        m.ChecklistItem(application_id=app.id, label=label, sort_order=n)
        for n, label in enumerate(DEFAULT_CHECKLIST)
    )
    db.flush()
    return _out(db, app, date.today())


@router.get("/{application_id}")
def read_one(application_id: int, me: SignedIn, db: Db) -> ApplicationOut:
    user = active_user(db, me.subject)
    return _out(db, _own(db, user.id, application_id), date.today())


@router.patch("/{application_id}")
def update(application_id: int, body: ApplicationPatch, me: SignedIn, db: Db) -> ApplicationOut:
    user = active_user(db, me.subject)
    app = _own(db, user.id, application_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field in {"status", "notes"}:
            continue
        setattr(app, field, value)
    db.flush()
    return _out(db, app, date.today())


@router.patch("/{application_id}/checklist/{item_id}")
def tick(application_id: int, item_id: int, done: bool, me: SignedIn, db: Db) -> ApplicationOut:
    user = active_user(db, me.subject)
    app = _own(db, user.id, application_id)
    item = db.scalar(
        select(m.ChecklistItem).where(
            m.ChecklistItem.id == item_id, m.ChecklistItem.application_id == app.id
        )
    )
    if item is None:
        raise NotFoundError
    item.done = done
    db.flush()
    return _out(db, app, date.today())


@router.delete("/{application_id}", status_code=204)
def remove(application_id: int, me: SignedIn, db: Db) -> Response:
    user = active_user(db, me.subject)
    _own(db, user.id, application_id)
    db.execute(delete(m.Application).where(m.Application.id == application_id))
    return Response(status_code=204)
