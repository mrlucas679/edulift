"""Checks a learner's marks against one programme. Pure: same input, same answer."""

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from eligibility.aps import score
from eligibility.marks import without_lo

Result = Literal["pass", "fail", "unknown"]
Outcome = Literal[
    "incomplete", "closed", "not_eligible", "aps_only", "subjects_only",
    "qualifies_unconfirmed", "qualifies_selection", "qualifies",
]  # fmt: skip

CLOSING_SOON_DAYS = 14
MIN_SUBJECTS = 6


@dataclass(frozen=True)
class Option:
    subject: str
    min_percent: int


@dataclass(frozen=True)
class Rules:
    min_aps: int | None
    scheme: str | None
    groups: list[list[Option]] = field(default_factory=list)  # each group: alternatives
    selection: bool = False
    opens_on: date | None = None
    closes_on: date | None = None


@dataclass(frozen=True)
class Check:
    name: str
    required: str
    yours: str
    result: Result


@dataclass(frozen=True)
class Verdict:
    outcome: Outcome
    score: int | None
    checks: list[Check]
    window: Literal["open", "closing_soon", "closed", "not_open", "unknown"]


def evaluate(marks: dict[str, int], rules: Rules, today: date) -> Verdict:
    window = _window(rules, today)
    if len(without_lo(marks)) < MIN_SUBJECTS:
        return Verdict("incomplete", None, [], window)

    aps = score(rules.scheme, marks)
    checks = [_score_check(aps, rules.min_aps)]
    checks += [_group_check(i, g, marks) for i, g in enumerate(rules.groups, start=1)]
    return Verdict(_outcome(checks, rules.selection, window), aps, checks, window)


def _window(
    rules: Rules, today: date
) -> Literal["open", "closing_soon", "closed", "not_open", "unknown"]:
    if rules.closes_on is None:
        return "unknown"
    if today > rules.closes_on:
        return "closed"
    if rules.opens_on and today < rules.opens_on:
        return "not_open"
    return "closing_soon" if (rules.closes_on - today).days <= CLOSING_SOON_DAYS else "open"


def _score_check(aps: int | None, minimum: int | None) -> Check:
    if aps is None or minimum is None:
        return Check("score", str(minimum or "?"), str(aps if aps is not None else "?"), "unknown")
    return Check("score", str(minimum), str(aps), "pass" if aps >= minimum else "fail")


def _group_check(n: int, group: list[Option], marks: dict[str, int]) -> Check:
    required = " or ".join(f"{o.subject} {o.min_percent}%" for o in group)
    taken = [o for o in group if o.subject in marks]
    yours = ", ".join(f"{o.subject} {marks[o.subject]}%" for o in taken) or "not taken"
    met = any(marks[o.subject] >= o.min_percent for o in taken)
    return Check(f"subjects_{n}", required, yours, "pass" if met else "fail")


def _outcome(checks: list[Check], selection: bool, window: str) -> Outcome:
    score_check, groups = checks[0], checks[1:]
    if window == "closed":
        return "closed"
    groups_fail = any(c.result == "fail" for c in groups)
    if score_check.result == "fail":
        return "not_eligible" if groups_fail else "subjects_only"
    if groups_fail:
        return "aps_only"
    if score_check.result == "unknown":
        return "qualifies_unconfirmed"
    return "qualifies_selection" if selection else "qualifies"
