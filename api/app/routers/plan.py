"""My plan: up to three programmes, each with a verdict from saved marks."""

from datetime import date

from fastapi import APIRouter
from sqlalchemy import delete, select

from app import models as m
from app.deps import Db, SignedIn
from app.errors import NotFoundError
from app.routers.marks import active_user, latest_marks
from app.schemas import PlanIn, PlanOut, PlanTargetOut
from app.verdicts import programme_verdict, subject_names

router = APIRouter(prefix="/me/plan", tags=["plan"])


@router.get("")
def read(me: SignedIn, db: Db) -> PlanOut:
    user = active_user(db, me.subject)
    marks = latest_marks(db, user.id)
    rows = db.execute(
        select(m.PlanTarget.programme_id, m.Programme, m.Institution.name)
        .join(m.Programme, m.Programme.id == m.PlanTarget.programme_id)
        .join(m.Institution, m.Institution.id == m.Programme.institution_id)
        .where(m.PlanTarget.user_id == user.id)
        .order_by(m.PlanTarget.position)
    ).all()
    names = subject_names(db, marks) if marks else {}
    today = date.today()
    targets = [
        PlanTargetOut(
            programme_id=programme.id,
            name=programme.name,
            institution=institution,
            verdict=programme_verdict(db, programme, marks, names, today) if marks else None,
        )
        for _, programme, institution in rows
    ]
    return PlanOut(targets=targets)


@router.put("")
def replace(body: PlanIn, me: SignedIn, db: Db) -> PlanOut:
    user = active_user(db, me.subject)
    for programme_id in body.programme_ids:
        if db.get(m.Programme, programme_id) is None:
            raise NotFoundError
    db.execute(delete(m.PlanTarget).where(m.PlanTarget.user_id == user.id))
    db.add_all(
        m.PlanTarget(user_id=user.id, programme_id=programme_id, position=position)
        for position, programme_id in enumerate(body.programme_ids)
    )
    db.flush()
    return read(me, db)
