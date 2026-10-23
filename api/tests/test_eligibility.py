from datetime import date

import pytest

from eligibility.aps import best6, score
from eligibility.marks import level
from eligibility.verdict import Option, Rules, evaluate

TODAY = date(2026, 10, 23)

# Made-up learner from the hackathon brief.
THANDI = {
    "english_hl": 72, "mathematics": 68, "physical_sciences": 70, "life_sciences": 65,
    "geography": 74, "isizulu_fal": 60, "life_orientation": 90,
}  # fmt: skip


@pytest.mark.parametrize(
    ("percent", "expected"),
    [(0, 1), (29, 1), (30, 2), (39, 2), (40, 3), (49, 3), (50, 4), (59, 4),
     (60, 5), (69, 5), (70, 6), (79, 6), (80, 7), (100, 7)],
)  # fmt: skip
def test_level_boundaries(percent: int, expected: int) -> None:
    assert level(percent) == expected


@pytest.mark.parametrize("percent", [-1, 101])
def test_level_rejects_impossible_marks(percent: int) -> None:
    with pytest.raises(ValueError, match="out of range"):
        level(percent)


def test_best6_ignores_life_orientation_and_the_seventh_subject() -> None:
    # 6+5+6+5+6+5 = 33; LO at 90% would be a 7 but must not count.
    assert best6(THANDI) == 33


def test_unverified_scheme_gives_no_score() -> None:
    assert score("wits_best7", THANDI) is None
    assert score(None, THANDI) is None


def rules(**kw: object) -> Rules:
    base: dict[str, object] = {
        "min_aps": 30,
        "scheme": "standard_best6",
        "groups": [[Option("mathematics", 60)]],
        "opens_on": date(2026, 4, 1),
        "closes_on": date(2026, 12, 31),
    }
    return Rules(**(base | kw))  # type: ignore[arg-type]


def test_qualifies() -> None:
    v = evaluate(THANDI, rules(), TODAY)
    assert (v.outcome, v.score) == ("qualifies", 33)
    assert [c.result for c in v.checks] == ["pass", "pass"]


def test_selection_programme_never_promises_a_place() -> None:
    assert evaluate(THANDI, rules(selection=True), TODAY).outcome == "qualifies_selection"


def test_score_met_but_subject_short_is_aps_only() -> None:
    v = evaluate(THANDI, rules(groups=[[Option("mathematics", 70)]]), TODAY)
    assert v.outcome == "aps_only"
    assert v.checks[1].yours == "mathematics 68%"


def test_subjects_met_but_score_short_is_subjects_only() -> None:
    assert evaluate(THANDI, rules(min_aps=35), TODAY).outcome == "subjects_only"


def test_both_short_is_not_eligible() -> None:
    v = evaluate(THANDI, rules(min_aps=35, groups=[[Option("mathematics", 70)]]), TODAY)
    assert v.outcome == "not_eligible"


def test_any_alternative_in_a_group_is_enough() -> None:
    group = [Option("mathematics", 80), Option("maths_literacy", 50), Option("geography", 70)]
    assert evaluate(THANDI, rules(groups=[group]), TODAY).outcome == "qualifies"


def test_subject_not_taken_fails_its_group() -> None:
    v = evaluate(THANDI, rules(groups=[[Option("accounting", 50)]]), TODAY)
    assert v.checks[1].yours == "not taken"
    assert v.outcome == "aps_only"


def test_unknown_minimum_is_never_a_pass_or_fail() -> None:
    v = evaluate(THANDI, rules(min_aps=None), TODAY)
    assert v.checks[0].result == "unknown"
    assert v.outcome == "qualifies_unconfirmed"


def test_too_few_subjects_is_incomplete() -> None:
    v = evaluate({"mathematics": 90, "english_hl": 90, "life_orientation": 90}, rules(), TODAY)
    assert v.outcome == "incomplete"


@pytest.mark.parametrize(
    ("closes", "expected"),
    [
        (date(2026, 10, 22), "closed"),
        (date(2026, 10, 23), "closing_soon"),
        (date(2026, 11, 6), "closing_soon"),
        (date(2026, 11, 7), "open"),
        (None, "unknown"),
    ],
)
def test_window_states(closes: date | None, expected: str) -> None:
    assert evaluate(THANDI, rules(closes_on=closes), TODAY).window == expected


def test_closed_window_wins_even_when_marks_qualify() -> None:
    assert evaluate(THANDI, rules(closes_on=date(2026, 10, 1)), TODAY).outcome == "closed"


def test_not_open_yet() -> None:
    v = evaluate(THANDI, rules(opens_on=date(2026, 11, 1)), TODAY)
    assert v.window == "not_open"
