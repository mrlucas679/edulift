"""Where do I stand for this programme? Marks come with the request and aren't stored."""

import re
from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.deps import Db, DbEngine, SignedIn
from app.errors import NotFoundError
from app.routers.aps import UnknownSubjectError
from app.routers.marks import active_user, latest_marks
from app.schemas import CheckOut, CheckRequest, VerdictOut
from eligibility.verdict import Check, Option, Rules, evaluate

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
    names = {sid: name for sid, name in db.execute(select(m.Subject.id, m.Subject.name))}
    if unknown := sorted(set(marks) - set(names)):
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
    v = evaluate(marks, rules, date.today())
    return VerdictOut(
        programme_id=programme.id,
        outcome=v.outcome,
        score=v.score,
        scheme=institution.aps_scheme,
        window=v.window,
        checks=[_with_source(c, names, programme.source) for c in v.checks],
    )


def _with_source(check: Check, names: dict[str, str], source: m.Source) -> CheckOut:
    # Every check comes from the programme's own prospectus, so each one carries its source.
    return CheckOut(
        name=check.name,
        result=check.result,
        required=_named_subjects(check.required, names),
        yours=_named_subjects(check.yours, names),
        source_url=source.url,
        checked_on=source.checked_on,
    )


def _named_subjects(text: str, names: dict[str, str]) -> str:
    # Subject ids read badly on screen; show names instead.
    return re.sub(r"\b[a-z_]+\b", lambda w: names.get(w.group(), w.group()), text)
