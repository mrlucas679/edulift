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
from app.schemas import AlternativesOut, CheckRequest, ProgrammeOut, RouteOut
from app.verdicts import programme_verdict, subject_names
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
    if programme_verdict(db, target, marks, names, today, nbt=nbt).outcome in QUALIFIES:
        return AlternativesOut(routes=[], funding=[], work=[])

    profile = db.get(m.Profile, user.id)
    province = profile.province if profile and profile.province else ""
    candidates = []
    for programme in db.scalars(select(m.Programme).where(m.Programme.id != programme_id)):
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
                outcome=verdict.outcome,
                window=verdict.window,
                closes_on=programme.closes_on,
            )
        )
    routes = plan_b(
        Target(target.id, target.institution_id, target.field_id, target.qualification),
        candidates,
        province,
    )
    facts = learner_facts(db, user, today)
    funding = route(matched(open_opportunities(db, ("bursary", "loan")), facts))
    work_kinds = ("learnership", "work")
    same_field = [
        o for o in open_opportunities(db, work_kinds) if o.field_id in (None, target.field_id)
    ]
    work = route(matched(same_field, facts))
    return AlternativesOut(
        routes=[
            RouteOut(
                key=r.key,
                title=r.title,
                empty_reason=r.empty_reason,
                items=[
                    ProgrammeOut.model_validate(db.get_one(m.Programme, c.programme_id))
                    for c in r.items
                ],
            )
            for r in routes
        ],
        funding=[to_matched(o, a.verdict, a.results) for o, a in funding],
        work=[to_matched(o, a.verdict, a.results) for o, a in work],
    )
