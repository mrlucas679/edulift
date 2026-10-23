"""Funding and work: do an opportunity's criteria fit the learner's facts? Plain data in and out."""

from dataclasses import dataclass, field
from typing import Literal

Status = Literal["met", "not_met", "unknown"]
Verdict = Literal["not_matched", "may_qualify", "qualifies"]

# Checks we can evaluate from data the app holds. Anything else is unknown.
KNOWN_CHECKS = frozenset({"province", "age_min", "age_max", "certificate"})


@dataclass(frozen=True)
class Facts:
    province: str | None
    age: int | None
    certificate: str | None


@dataclass(frozen=True)
class Criterion:
    check: str
    values: tuple[str, ...] = ()
    number: int | None = None


@dataclass(frozen=True)
class Assessment:
    verdict: Verdict
    results: list[tuple[str, Status]] = field(default_factory=list)


def _check(criterion: Criterion, facts: Facts) -> Status:
    if criterion.check not in KNOWN_CHECKS:
        return "unknown"
    if criterion.check == "province":
        return _member(facts.province, criterion.values)
    if criterion.check == "certificate":
        return _member(facts.certificate, criterion.values)
    if facts.age is None or criterion.number is None:
        return "unknown"
    if criterion.check == "age_min":
        return "met" if facts.age >= criterion.number else "not_met"
    return "met" if facts.age <= criterion.number else "not_met"


def _member(value: str | None, allowed: tuple[str, ...]) -> Status:
    if value is None:
        return "unknown"
    return "met" if value in allowed else "not_met"


def assess(criteria: list[Criterion], facts: Facts) -> Assessment:
    # Nothing published means nothing confirmed, so never a firm match.
    results = [(c.check, _check(c, facts)) for c in criteria]
    statuses = [s for _, s in results]
    if not criteria or "unknown" in statuses:
        return Assessment("may_qualify", results)
    if "not_met" in statuses:
        return Assessment("not_matched", results)
    return Assessment("qualifies", results)
