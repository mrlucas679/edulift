"""Plan B: what to look at when a target programme says no. Plain data in, ranked lists out."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

# Easier entry in the order the rules doc gives: extended degree, then diploma, then certificate.
EASIER_ENTRY = ("extended_degree", "diploma", "higher_certificate")
TVET = ("nc_v", "n4")
QUALIFIES = frozenset({"qualifies", "qualifies_selection", "qualifies_unconfirmed"})
ROUTE_LIMIT = 3


@dataclass(frozen=True)
class Target:
    programme_id: str
    institution_id: str
    field_id: str
    qualification: str


@dataclass(frozen=True)
class Candidate:
    programme_id: str
    name: str
    institution_id: str
    institution_province: str
    field_id: str
    qualification: str
    outcome: str
    window: str
    closes_on: date | None


@dataclass(frozen=True)
class Route:
    key: str
    title: str
    items: list[Candidate]
    empty_reason: str


def _rank(candidate: Candidate, learner_province: str) -> tuple[int, date, int, str, str]:
    # Open before closed, then closing soonest, then the learner's own province, then name.
    closed = 1 if candidate.window in {"closed", "not_open"} else 0
    return (
        closed,
        candidate.closes_on or date.max,
        0 if candidate.institution_province == learner_province else 1,
        candidate.name,
        candidate.programme_id,
    )


def _top(
    candidates: list[Candidate],
    learner_province: str,
    first: Callable[[Candidate], int] = lambda _: 0,
) -> list[Candidate]:
    eligible = [c for c in candidates if c.outcome in QUALIFIES]
    eligible.sort(key=lambda c: (first(c), *_rank(c, learner_province)))
    return eligible[:ROUTE_LIMIT]


def plan_b(target: Target, candidates: list[Candidate], learner_province: str) -> list[Route]:
    others = [c for c in candidates if c.programme_id != target.programme_id]
    same_institution_same_field = [
        c
        for c in others
        if c.institution_id == target.institution_id and c.field_id == target.field_id
    ]
    same_field_elsewhere = [
        c
        for c in others
        if c.field_id == target.field_id and c.institution_id != target.institution_id
    ]
    tvet = [c for c in others if c.field_id == target.field_id and c.qualification in TVET]

    routes = [
        Route(
            "easier_entry",
            "Easier entry at your institution",
            _top(
                [c for c in same_institution_same_field if c.qualification in EASIER_ENTRY],
                learner_province,
                first=lambda c: EASIER_ENTRY.index(c.qualification),
            ),
            "No easier-entry programme in this field at the same institution.",
        ),
        Route(
            "same_field",
            "Same field elsewhere",
            _top(same_field_elsewhere, learner_province),
            "No other institution offers this field that you qualify for.",
        ),
        Route(
            "tvet",
            "TVET college",
            _top(tvet, learner_province),
            "No NC(V) or N4 programme in this field that you qualify for.",
        ),
    ]
    return routes
