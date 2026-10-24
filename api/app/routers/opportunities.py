from datetime import date
from typing import Literal

from fastapi import APIRouter

from app import models as m
from app.deps import Db, SignedIn
from app.opportunities import learner_facts, matched, open_opportunities
from app.routers.marks import active_user
from app.schemas import CriterionOut, MatchedOpportunityOut, OpportunityOut
from eligibility.opportunities import Status, Verdict

router = APIRouter(tags=["opportunities"])

Kind = Literal["bursary", "loan", "learnership", "work"]
KINDS: tuple[str, ...] = ("bursary", "loan", "learnership", "work")


@router.get("/opportunities")
def browse(db: Db, kind: Kind | None = None) -> list[OpportunityOut]:
    rows = open_opportunities(db, (kind,) if kind else KINDS)
    return [OpportunityOut.model_validate(o) for o in rows]


@router.get("/me/opportunities")
def for_me(me: SignedIn, db: Db, kind: Kind | None = None) -> list[MatchedOpportunityOut]:
    user = active_user(db, me.subject)
    facts = learner_facts(db, user, date.today())
    pairs = matched(open_opportunities(db, (kind,) if kind else KINDS), facts)
    return [to_matched(o, a.verdict, a.results) for o, a in pairs]


def to_matched(
    opportunity: m.Opportunity, verdict: Verdict, results: list[tuple[str, Status]]
) -> MatchedOpportunityOut:
    if verdict == "not_matched":
        raise ValueError("not-matched opportunities are never shown")
    return MatchedOpportunityOut(
        **OpportunityOut.model_validate(opportunity).model_dump(),
        verdict=verdict,
        checks=[CriterionOut(check=c, status=s) for c, s in results],
    )
