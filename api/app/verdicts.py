import re
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.routers.aps import UnknownSubjectError
from app.schemas import CheckOut, VerdictOut
from eligibility.verdict import Band, Check, Floor, Nbt, Option, Rules, evaluate


def subject_names(db: Session, marks: dict[str, int]) -> dict[str, str]:
    names = {sid: name for sid, name in db.execute(select(m.Subject.id, m.Subject.name))}
    if unknown := sorted(set(marks) - set(names)):
        raise UnknownSubjectError(f"Unknown subjects: {', '.join(unknown[:5])}")
    return names


def programme_verdict(
    db: Session,
    programme: m.Programme,
    marks: dict[str, int],
    names: dict[str, str],
    today: date,
) -> VerdictOut:
    institution = db.get_one(m.Institution, programme.institution_id)
    cycle = db.scalars(
        select(m.Cycle)
        .where(m.Cycle.institution_id == institution.id)
        .order_by(m.Cycle.intake_year.desc())
    ).first()
    groups: dict[int, list[Option]] = {}
    for r in programme.requirements:
        groups.setdefault(r.group_no, []).append(Option(r.subject_id, r.min_percent))

    bands = [
        Band(
            label=b.label,
            metric=b.metric,
            score=b.score,
            applies_to=b.applies_to,
            groups=[[Option(o["subject"], o["min"]) for o in g] for g in b.requirements],
            nbt=_nbt_groups(b.nbt),
        )
        for b in programme.fps_bands
    ]
    rules = Rules(
        min_aps=programme.min_aps,
        scheme=programme.aps_scheme or institution.aps_scheme,
        groups=list(groups.values()),
        selection=programme.selection,
        bands=bands,
        nbt=_nbt_groups(programme.nbt),
        floor=Floor(programme.floor["count"], programme.floor["min"]) if programme.floor else None,
        opens_on=cycle.opens_on if cycle else None,
        closes_on=programme.closes_on or (cycle.closes_on if cycle else None),
    )
    v = evaluate(marks, rules, today)
    return VerdictOut(
        programme_id=programme.id,
        outcome=v.outcome,
        score=v.score,
        scheme=programme.aps_scheme or institution.aps_scheme,
        window=v.window,
        checks=[_with_source(c, names, programme.source) for c in v.checks],
    )


def _nbt_groups(groups: list[list[dict[str, str]]]) -> list[list[Nbt]]:
    return [[Nbt(n["component"], n["level"]) for n in g] for g in groups]


def _with_source(check: Check, names: dict[str, str], source: m.Source) -> CheckOut:
    return CheckOut(
        name=check.name,
        result=check.result,
        required=_named_subjects(check.required, names),
        yours=_named_subjects(check.yours, names),
        source_url=source.url,
        checked_on=source.checked_on,
    )


def _named_subjects(text: str, names: dict[str, str]) -> str:
    return re.sub(r"\b[a-z_]+\b", lambda w: names.get(w.group(), w.group()), text)
