from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.deps import Db, DbEngine, SignedIn
from app.errors import NotFoundError
from app.nbt_levels import learner_nbt
from app.opportunities import learner_facts, matched, open_opportunities, route
from app.routers.marks import active_user, latest_marks
from app.routers.opportunities import to_matched
from app.schemas import (
    AlternativesOut,
    CheckRequest,
    ProgrammeOut,
    RouteItemOut,
    RouteOut,
    VerdictOut,
)
from app.verdicts import programme_verdict, subject_names
from eligibility.opportunities import Assessment
from eligibility.plan_b import QUALIFIES, Candidate, Target, plan_b

router = APIRouter(prefix="/programmes", tags=["alternatives"])


@router.post("/{programme_id}/alternatives")
def alternatives(
    programme_id: str, body: CheckRequest, me: SignedIn, db: Db, engine: DbEngine
) -> AlternativesOut:
    rate_limit.check(engine, "check:user", me.subject, limit=60, window_seconds=60)
    target = db.get(m.Programme, programme_id)
    if target is None:
        raise NotFoundError
    user = active_user(db, me.subject)
    marks = body.marks if body.marks is not None else latest_marks(db, user.id)
    if marks is None:
        raise NotFoundError("Save your marks first.")
    names = subject_names(db, marks)
    today = date.today()

    nbt = learner_nbt(db, user.id)
    # Qualifying needs no other study route, but funding and work still count.
    qualifies = programme_verdict(db, target, marks, names, today, nbt=nbt).outcome in QUALIFIES

    profile = db.get(m.Profile, user.id)
    province = profile.province if profile and profile.province else ""
    candidates = []
    query = select(m.Programme).where(m.Programme.id != programme_id)
    others: list[m.Programme] = [] if qualifies else list(db.scalars(query))
    for programme in others:
        verdict = programme_verdict(db, programme, marks, names, today, nbt=nbt)
        institution = db.get_one(m.Institution, programme.institution_id)
        candidates.append(
            Candidate(
                programme_id=programme.id,
                name=programme.name,
                institution_id=institution.id,
                institution_province=institution.province,
                field_id=programme.field_id,
                qualification=programme.qualification,
                outcome=_met_if_open(verdict),
                window=verdict.window,
                closes_on=programme.closes_on,
            )
        )
    routes = (
        []
        if qualifies
        else plan_b(
            Target(target.id, target.institution_id, target.field_id, target.qualification),
            candidates,
            province,
        )
    )
    facts = learner_facts(db, user, today)
    funding = route(near(matched(open_opportunities(db, ("bursary", "loan")), facts), target))
    # Learnerships name a trade, so one with no field set isn't offered as a route.
    work_pairs = matched(open_opportunities(db, ("learnership", "work")), facts)
    work = route(near([(o, a) for o, a in work_pairs if o.field_id], target))
    return AlternativesOut(
        routes=[
            RouteOut(
                key=r.key,
                title=r.title,
                empty_reason=r.empty_reason,
                items=[
                    RouteItemOut(
                        **ProgrammeOut.model_validate(
                            db.get_one(m.Programme, c.programme_id)
                        ).model_dump(),
                        window=c.window,
                    )
                    for c in r.items
                ],
            )
            for r in routes
        ],
        funding=[to_matched(o, a.verdict, a.results) for o, a in funding],
        work=[to_matched(o, a.verdict, a.results) for o, a in work],
    )


def near(
    pairs: list[tuple[m.Opportunity, Assessment]], target: m.Programme
) -> list[tuple[m.Opportunity, Assessment]]:
    """Same field first, then open-to-all; other fields are left out."""
    top = target.field_id.split(".")[0]

    def rank(field: str | None) -> int | None:
        if field is None:
            return 1
        return 0 if field.split(".")[0] == top else None

    kept = [(rank(o.field_id), o, a) for o, a in pairs]
    return [(o, a) for r, o, a in sorted(kept, key=lambda x: x[0] or 0) if r is not None]


def _met_if_open(verdict: VerdictOut) -> str:
    """A closed course the learner would otherwise get into still counts as a route.

    Plan B ranks it after open ones, and the page says it is closed for this intake.
    """
    if verdict.outcome == "closed" and all(c.result == "pass" for c in verdict.checks):
        return "qualifies"
    return verdict.outcome
