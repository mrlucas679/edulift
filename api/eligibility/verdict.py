"""Checks a learner's marks against one programme. Pure: same input, same answer."""

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from eligibility.aps import score
from eligibility.marks import without_lo

Result = Literal["pass", "fail", "unknown"]
Window = Literal["open", "closing_soon", "closed", "not_open", "unknown"]
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


NBT_LEVELS = ("basic", "intermediate", "upper_intermediate", "proficient")


@dataclass(frozen=True)
class Nbt:
    component: str  # "AL", "QL" or "MAT"
    level: str  # one of NBT_LEVELS


@dataclass(frozen=True)
class Band:
    label: str
    score: int
    groups: list[list[Option]]
    applies_to: str = "all"  # "targeted_redress" bands are not judged yet
    metric: str = "FPS"  # "WPS" needs the disadvantage factor, which we do not collect
    nbt: list[list[Nbt]] = field(default_factory=list)  # we hold no NBT results yet


@dataclass(frozen=True)
class Rules:
    min_aps: int | None
    scheme: str | None
    groups: list[list[Option]] = field(default_factory=list)  # each group: alternatives
    selection: bool = False
    opens_on: date | None = None
    closes_on: date | None = None
    bands: list[Band] = field(default_factory=list)  # highest score first
    nbt: list[list[Nbt]] = field(default_factory=list)


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
    window: Window


def evaluate(marks: dict[str, int], rules: Rules, today: date) -> Verdict:
    window = _window(rules, today)
    if len(without_lo(marks)) < MIN_SUBJECTS:
        return Verdict("incomplete", None, [], window)

    aps = score(rules.scheme, marks)
    if rules.bands:
        return _banded(aps, marks, rules, window)
    checks = [_score_check(aps, rules.min_aps)]
    checks += [_group_check(i, g, marks) for i, g in enumerate(rules.groups, start=1)]
    checks += [_nbt_check(i, g) for i, g in enumerate(rules.nbt, start=1)]
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


def _group_met(group: list[Option], marks: dict[str, int]) -> bool:
    return any(o.subject in marks and marks[o.subject] >= o.min_percent for o in group)


def _describe(group: list[Option]) -> str:
    return " or ".join(f"{o.subject} {o.min_percent}%" for o in group)


def _describe_nbt(group: list[Nbt]) -> str:
    return " or ".join(f"NBT {n.component} {n.level}" for n in group)


def _nbt_check(n: int, group: list[Nbt]) -> Check:
    # Never pass or fail: we hold no NBT results, so the rule stays unconfirmed.
    return Check(f"nbt_{n}", _describe_nbt(group), "no NBT result", "unknown")


def _group_check(n: int, group: list[Option], marks: dict[str, int]) -> Check:
    required = _describe(group)
    taken = [o for o in group if o.subject in marks]
    yours = ", ".join(f"{o.subject} {marks[o.subject]}%" for o in taken) or "not taken"
    return Check(f"subjects_{n}", required, yours, "pass" if _group_met(group, marks) else "fail")


def _banded(aps: int | None, marks: dict[str, int], rules: Rules, window: Window) -> Verdict:
    if aps is None:
        return Verdict("incomplete", None, [], window)
    checks = []
    for band in sorted(rules.bands, key=lambda b: -b.score):
        if band.applies_to != "all":
            continue
        parts = [f"{band.metric} {band.score}"] + [_describe(g) for g in band.groups]
        parts += [_describe_nbt(g) for g in band.nbt]
        groups_met = all(_group_met(g, marks) for g in band.groups)
        result: Result
        if band.metric == "FPS_NBT":  # score includes NBT points, so it cannot be computed
            result = "unknown"
        elif not groups_met:
            result = "fail"
        elif band.metric == "WPS":  # adds the disadvantage factor, so a low FPS may still reach it
            result = "unknown"
        elif aps < band.score:
            result = "fail"
        else:
            result = "unknown" if band.nbt else "pass"  # NBT results are not held
        checks.append(Check(band.label, " and ".join(parts), f"FPS {aps}", result))
    if window == "closed":
        return Verdict("closed", aps, checks, window)
    if any(c.result == "pass" for c in checks):
        top = checks[0].result == "pass"
        outcome: Outcome = "qualifies" if top and not rules.selection else "qualifies_selection"
        return Verdict(outcome, aps, checks, window)
    if any(c.result == "unknown" for c in checks):
        return Verdict("qualifies_unconfirmed", aps, checks, window)
    return Verdict("not_eligible", aps, checks, window)


def _outcome(checks: list[Check], selection: bool, window: str) -> Outcome:
    score_check, groups = checks[0], checks[1:]
    if window == "closed":
        return "closed"
    groups_fail = any(c.result == "fail" for c in groups)
    if score_check.result == "fail":
        return "not_eligible" if groups_fail else "subjects_only"
    if groups_fail:
        return "aps_only"
    if score_check.result == "unknown" or any(c.result == "unknown" for c in groups):
        return "qualifies_unconfirmed"
    return "qualifies_selection" if selection else "qualifies"
