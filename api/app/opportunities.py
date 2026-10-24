from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.age import age_on
from eligibility.opportunities import Assessment, Criterion, Facts, assess

ROUTE_LIMIT = 3


def learner_facts(db: Session, user: m.User, today: date) -> Facts:
    profile = db.get(m.Profile, user.id)
    if profile is None:
        return Facts(None, None, None)
    return Facts(
        province=profile.province,
        age=age_on(profile.birth_date, today),
        certificate=profile.certificate,
    )


def open_opportunities(db: Session, kinds: tuple[str, ...]) -> list[m.Opportunity]:
    return list(
        db.scalars(
            select(m.Opportunity).where(m.Opportunity.kind.in_(kinds)).order_by(m.Opportunity.name)
        )
    )


def criteria_of(opportunity: m.Opportunity) -> list[Criterion]:
    return [
        Criterion(c["check"], tuple(c.get("values", [])), c.get("number"))
        for c in opportunity.criteria
    ]


def matched(
    opportunities: list[m.Opportunity], facts: Facts
) -> list[tuple[m.Opportunity, Assessment]]:
    results = [(o, assess(criteria_of(o), facts)) for o in opportunities]
    kept = [(o, a) for o, a in results if a.verdict != "not_matched"]
    return sorted(kept, key=lambda pair: _rank(pair[0], pair[1]))


def _rank(opportunity: m.Opportunity, result: Assessment) -> tuple[int, date, str]:
    firm = 0 if result.verdict == "qualifies" else 1
    return (firm, opportunity.closes_on or date.max, opportunity.name)


def route(pairs: list[tuple[m.Opportunity, Assessment]]) -> list[tuple[m.Opportunity, Assessment]]:
    return pairs[:ROUTE_LIMIT]
