"""Where do I stand for this programme? Marks come with the request and aren't stored."""

from dataclasses import asdict
from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.deps import Db, DbEngine, SignedIn
from app.errors import NotFoundError
from app.routers.aps import UnknownSubjectError
from app.schemas import CheckOut, PreviewRequest, VerdictOut
from eligibility.verdict import Option, Rules, evaluate

router = APIRouter(prefix="/programmes", tags=["verdicts"])


@router.post("/{programme_id}/check")
def check(
    programme_id: str, body: PreviewRequest, me: SignedIn, db: Db, engine: DbEngine
) -> VerdictOut:
    rate_limit.check(engine, "check:user", me.subject, limit=60, window_seconds=60)
    programme = db.get(m.Programme, programme_id)
    if programme is None:
        raise NotFoundError
    if unknown := sorted(set(body.marks) - set(db.scalars(select(m.Subject.id)))):
        raise UnknownSubjectError(f"Unknown subjects: {', '.join(unknown[:5])}")

    institution = db.get_one(m.Institution, programme.institution_id)
    cycle = db.scalars(
        select(m.Cycle)
        .where(m.Cycle.institution_id == institution.id)
        .order_by(m.Cycle.intake_year.desc())
    ).first()
    groups: dict[int, list[Option]] = {}
    for r in programme.requirements:
        groups.setdefault(r.group_no, []).append(Option(r.subject_id, r.min_percent))

    rules = Rules(
        min_aps=programme.min_aps,
        scheme=institution.aps_scheme,
        groups=list(groups.values()),
        selection=programme.selection,
        opens_on=cycle.opens_on if cycle else None,
        closes_on=programme.closes_on or (cycle.closes_on if cycle else None),
    )
    v = evaluate(body.marks, rules, date.today())
    return VerdictOut(
        programme_id=programme.id,
        outcome=v.outcome,
        score=v.score,
        scheme=institution.aps_scheme,
        window=v.window,
        checks=[CheckOut(**asdict(c)) for c in v.checks],
    )
