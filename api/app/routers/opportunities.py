from datetime import date
from typing import Literal

from fastapi import APIRouter

from app import models as m
from app.accounts import ensure_account
from app.deps import Db, SignedIn
from app.errors import NotFoundError
from app.opportunities import learner_facts, matched, open_opportunities
from app.schemas import CriterionOut, MatchedOpportunityOut, OpportunityOut
from eligibility.opportunities import Status, Verdict

router = APIRouter(tags=["opportunities"])

Kind = Literal["bursary", "loan", "learnership", "work"]
KINDS: tuple[str, ...] = ("bursary", "loan", "learnership", "work")


@router.get("/opportunities")
def browse(db: Db, kind: Kind | None = None) -> list[OpportunityOut]:
    rows = open_opportunities(db, (kind,) if kind else KINDS)
    return [OpportunityOut.model_validate(o) for o in rows]


@router.get("/opportunities/{opportunity_id}")
def one(opportunity_id: str, db: Db) -> OpportunityOut:
    row = db.get(m.Opportunity, opportunity_id)
    if row is None:
        raise NotFoundError
    return OpportunityOut.model_validate(row)


@router.get("/me/opportunities")
def for_me(me: SignedIn, db: Db, kind: Kind | None = None) -> list[MatchedOpportunityOut]:
    user = ensure_account(db, me.subject)
    if user.status != "active":
        # Not set up yet: show the open listings, unchecked, rather than guessing a match.
        open_now = open_opportunities(db, (kind,) if kind else KINDS)
        return [unchecked_out(o) for o in open_now]
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


def unchecked_out(opportunity: m.Opportunity) -> MatchedOpportunityOut:
    return MatchedOpportunityOut(
        **OpportunityOut.model_validate(opportunity).model_dump(),
        verdict="not_checked",
        checks=[],
    )
