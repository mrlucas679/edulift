"""Where do I stand for this programme? Marks come with the request and aren't stored."""

from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.deps import Db, DbEngine, SignedIn
from app.errors import NotFoundError
from app.nbt_levels import learner_nbt
from app.routers.marks import active_user, latest_marks
from app.schemas import CheckRequest, VerdictOut
from app.verdicts import programme_verdict, subject_names

router = APIRouter(prefix="/programmes", tags=["verdicts"])


@router.post("/{programme_id}/check")
def check(
    programme_id: str, body: CheckRequest, me: SignedIn, db: Db, engine: DbEngine
) -> VerdictOut:
    rate_limit.check(engine, "check:user", me.subject, limit=60, window_seconds=60)
    programme = db.get(m.Programme, programme_id)
    if programme is None:
        raise NotFoundError
    marks = body.marks
    if marks is None:
        marks = latest_marks(db, active_user(db, me.subject).id)
        if marks is None:
            raise NotFoundError("Save your marks first.")
    names = subject_names(db, marks)
    return programme_verdict(
        db,
        programme,
        marks,
        names,
        date.today(),
        nbt=learner_nbt(db, me.subject),  # no account is created by a check
    )


class BatchOut(BaseModel):
    programme_id: str
    outcome: str


@router.post("/me/outcomes")
def check_all(body: CheckRequest, me: SignedIn, db: Db, engine: DbEngine) -> list[BatchOut]:
    """One verdict per programme, for the Study list badges. Marks are not stored."""
    rate_limit.check(engine, "check:user", me.subject, limit=60, window_seconds=60)
    marks = body.marks
    if marks is None:
        marks = latest_marks(db, active_user(db, me.subject).id)
        if marks is None:
            raise NotFoundError("Save your marks first.")
    names = subject_names(db, marks)
    nbt = learner_nbt(db, me.subject)
    today = date.today()
    programmes = db.scalars(select(m.Programme).order_by(m.Programme.id))
    return [
        BatchOut(
            programme_id=p.id,
            outcome=programme_verdict(db, p, marks, names, today, nbt=nbt).outcome,
        )
        for p in programmes
    ]
