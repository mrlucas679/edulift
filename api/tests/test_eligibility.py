from datetime import date

import pytest

from eligibility.aps import best6, score
from eligibility.marks import level
from eligibility.verdict import Band, Floor, Nbt, Option, Rules, evaluate

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
    assert score("uct_unknown", THANDI) is None
    assert score(None, THANDI) is None


def test_wits_scores_thandi_from_the_published_table() -> None:
    # English 72 -> 6+2, Maths 68 -> 5+2, Physical 70 -> 6, Geography 74 -> 6,
    # Life Sciences 65 -> 5, isiZulu 60 -> 5, LO 90 -> 4.  8+7+6+6+5+5+4 = 41
    assert score("wits_best7", THANDI) == 41


def test_wits_top_band_and_low_marks() -> None:
    marks = {
        "english_hl": 95, "mathematics": 59, "physical_sciences": 90, "life_sciences": 39,
        "geography": 40, "history": 0, "life_orientation": 55,
    }  # fmt: skip
    # English 10, Maths 4 (no bonus below 60), Physical 8, Life Sci 0, Geo 3, History 0, LO 0
    assert score("wits_best7", marks) == 25


def test_wits_does_not_give_maths_literacy_the_bonus() -> None:
    marks = {k: v for k, v in THANDI.items() if k != "mathematics"} | {"maths_literacy": 68}
    assert score("wits_best7", marks) == 39


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


# UCT's own worked examples from its 2027 NSC guidelines.
UCT_EXAMPLE = {
    "english_hl": 75, "isixhosa_fal": 70, "mathematics": 84, "physical_sciences": 86,
    "cat": 79, "egd": 69, "life_orientation": 80,
}  # fmt: skip


def test_uct_600_matches_the_published_example() -> None:
    assert score("uct_fps", UCT_EXAMPLE) == 463


def test_uct_science_matches_the_published_example() -> None:
    assert score("uct_science", UCT_EXAMPLE) == 633


def test_uct_ignores_marks_under_40_and_always_counts_english() -> None:
    marks = dict(UCT_EXAMPLE, english_hl=45, egd=39) | {"history": 90, "geography": 88}
    # English 45 forced in; best five others: 90, 88, 86, 84, 79. EGD 39 scores 0.
    assert score("uct_fps", marks) == 45 + 90 + 88 + 86 + 84 + 79


def _uct_band_rules(selection: bool = False) -> Rules:
    maths = [Option("mathematics", 65)]
    return Rules(
        min_aps=None,
        scheme="uct_fps",
        selection=selection,
        bands=[
            Band("guaranteed", 500, [[Option("mathematics", 80)]]),
            Band("likely", 480, [maths]),
            Band("possible", 390, [maths], applies_to="targeted_redress"),
        ],
    )


def test_band_top_score_with_subjects_qualifies() -> None:
    marks = {"english_hl": 90, "mathematics": 90, "physical_sciences": 90, "geography": 90,
             "life_sciences": 90, "isizulu_fal": 90}  # fmt: skip
    v = evaluate(marks, _uct_band_rules(), TODAY)
    assert v.outcome == "qualifies"
    assert v.score == 540


def test_band_below_top_but_above_likely_is_selection() -> None:
    # 85+75+80+80+80+80 = 480 (likely). Mathematics 75 misses the top band's 80%.
    marks = {"english_hl": 85, "mathematics": 75, "physical_sciences": 80, "geography": 80,
             "life_sciences": 80, "isizulu_fal": 80}  # fmt: skip
    v = evaluate(marks, _uct_band_rules(), TODAY)
    assert v.score == 480
    assert v.outcome == "qualifies_selection"


def test_band_subject_short_fails_that_band_only() -> None:
    # Mathematics 60% is below the likely band's 65%, so only the 'possible' band is
    # not judged here and no band passes.
    marks = {"english_hl": 60, "mathematics": 60, "physical_sciences": 60, "geography": 60,
             "life_sciences": 60, "isizulu_fal": 60}  # fmt: skip
    v = evaluate(marks, _uct_band_rules(), TODAY)
    assert v.outcome == "not_eligible"
    assert [c.result for c in v.checks] == ["fail", "fail"]


def test_targeted_redress_band_is_never_judged() -> None:
    marks = {"english_hl": 60, "mathematics": 70, "physical_sciences": 60, "geography": 60,
             "life_sciences": 60, "isizulu_fal": 60}  # fmt: skip
    v = evaluate(marks, _uct_band_rules(), TODAY)
    assert "possible" not in [c.name for c in v.checks]


def test_band_closed_window_wins() -> None:
    rules = _uct_band_rules()
    closed = Rules(**{**rules.__dict__, "closes_on": date(2026, 1, 1)})
    marks = {"english_hl": 75, "mathematics": 85, "physical_sciences": 80, "geography": 75,
             "life_sciences": 70, "isizulu_fal": 70}  # fmt: skip
    assert evaluate(marks, closed, TODAY).outcome == "closed"


def test_wps_band_is_unconfirmed_not_a_fail() -> None:
    # FPS 470 misses the guaranteed band and the WPS 'likely' band cannot be judged
    # without the disadvantage factor, so the answer is unconfirmed.
    rules = Rules(
        min_aps=None,
        scheme="uct_fps",
        bands=[
            Band("guaranteed", 500, [[Option("mathematics", 80)]]),
            Band("likely", 480, [[Option("mathematics", 80)]], metric="WPS"),
        ],
    )
    marks = {"english_hl": 80, "mathematics": 80, "physical_sciences": 70, "geography": 60,
             "life_sciences": 60, "isizulu_fal": 60}  # fmt: skip
    v = evaluate(marks, rules, TODAY)
    assert v.score == 410
    assert v.outcome == "qualifies_unconfirmed"


def _nbt_rules() -> Rules:
    return Rules(
        min_aps=None, scheme="uct_fps",
        groups=[[Option("mathematics", 60)]],
        nbt=[[Nbt("AL", "upper_intermediate")], [Nbt("QL", "upper_intermediate")]],
    )  # fmt: skip


def test_missing_nbt_is_unconfirmed_never_a_fail() -> None:
    marks = {"english_hl": 80, "mathematics": 80, "physical_sciences": 80, "geography": 80,
             "life_sciences": 80, "isizulu_fal": 80}  # fmt: skip
    v = evaluate(marks, _nbt_rules(), TODAY)
    assert v.outcome == "qualifies_unconfirmed"
    assert [c.result for c in v.checks[1:]] == ["pass", "unknown", "unknown"]


def test_failed_subject_still_fails_when_nbt_is_unknown() -> None:
    marks = {"english_hl": 80, "mathematics": 40, "physical_sciences": 80, "geography": 80,
             "life_sciences": 80, "isizulu_fal": 80}  # fmt: skip
    assert evaluate(marks, _nbt_rules(), TODAY).outcome == "aps_only"


def test_nbt_rule_reads_as_text() -> None:
    v = evaluate(
        dict.fromkeys(
            [
                "english_hl",
                "mathematics",
                "physical_sciences",
                "geography",
                "life_sciences",
                "isizulu_fal",
            ],
            80,
        ),
        _nbt_rules(),
        TODAY,
    )
    assert v.checks[-1].required == "NBT QL upper_intermediate"


def test_fps_nbt_band_cannot_be_judged() -> None:
    rules = Rules(
        min_aps=None,
        scheme="uct_fps",
        bands=[Band("guaranteed", 500, [[Option("mathematics", 80)]], metric="FPS_NBT")],
    )
    marks = dict.fromkeys(
        [
            "english_hl",
            "mathematics",
            "physical_sciences",
            "geography",
            "life_sciences",
            "isizulu_fal",
        ],
        90,
    )
    v = evaluate(marks, rules, TODAY)
    assert v.outcome == "qualifies_unconfirmed"


def _health_rules(min_aps: int = 450, floor: Floor | None = None) -> Rules:
    return Rules(
        min_aps=min_aps,
        scheme="uct_health",
        groups=[
            [Option("mathematics", 70)],
            [Option("physical_sciences", 70)],
            [Option("english_hl", 65), Option("english_fal", 65)],
        ],
        floor=floor or Floor(3, 70),
        bands=[Band("guaranteed", 810, [], metric="FPS_NBT", nbt=[[Nbt("AL", "proficient")]])],
    )


def test_health_is_unconfirmed_when_every_subject_rule_holds() -> None:
    marks = {"english_hl": 80, "mathematics": 80, "physical_sciences": 80, "geography": 75,
             "life_sciences": 75, "isizulu_fal": 75}  # fmt: skip
    v = evaluate(marks, _health_rules(), TODAY)
    assert v.outcome == "qualifies_unconfirmed"
    assert v.score == 80 * 3 + 75 * 3


def test_health_floor_fails_when_a_next_best_subject_is_short() -> None:
    marks = {"english_hl": 80, "mathematics": 80, "physical_sciences": 80, "geography": 69,
             "life_sciences": 75, "isizulu_fal": 75}  # fmt: skip
    v = evaluate(marks, _health_rules(), TODAY)
    assert v.outcome == "subjects_only"


def test_health_sub_minimum_aps_is_its_own_refusal() -> None:
    # 65 + 70 + 70 + 75 + 75 + 75 = 430: below the sub-minimum of 450, floor still met.
    marks = {"english_hl": 65, "mathematics": 70, "physical_sciences": 70, "geography": 75,
             "life_sciences": 75, "isizulu_fal": 75}  # fmt: skip
    v = evaluate(marks, _health_rules(min_aps=450), TODAY)
    assert v.outcome == "aps_only"


def test_health_floor_fails_below_three_other_subjects() -> None:
    marks = {"english_hl": 80, "mathematics": 80, "physical_sciences": 80, "geography": 80,
             "life_sciences": 80, "isizulu_fal": 80}  # fmt: skip
    rules = _health_rules(floor=Floor(4, 70))  # only three other subjects exist
    assert evaluate(marks, rules, TODAY).outcome == "subjects_only"


def test_uct_health_is_out_of_600() -> None:
    marks = dict.fromkeys(
        [
            "english_hl",
            "mathematics",
            "physical_sciences",
            "geography",
            "life_sciences",
            "isizulu_fal",
        ],
        50,
    )
    assert score("uct_health", marks) == 300


def _nbt_rules_with_score() -> Rules:
    return Rules(
        min_aps=0, scheme="uct_fps",
        groups=[[Option("mathematics", 60)]],
        nbt=[[Nbt("AL", "upper_intermediate")], [Nbt("QL", "upper_intermediate")]],
    )  # fmt: skip


SIX_AT_70 = dict.fromkeys(["english_hl", "mathematics", "physical_sciences", "geography",
                           "life_sciences", "isizulu_fal"], 70)  # fmt: skip


def test_held_nbt_level_that_meets_the_rule_passes() -> None:
    nbt = {"AL": "upper_intermediate", "QL": "proficient"}
    v = evaluate(SIX_AT_70, _nbt_rules_with_score(), TODAY, nbt)
    assert [c.result for c in v.checks[2:]] == ["pass", "pass"]


def test_held_nbt_level_below_the_rule_fails() -> None:
    nbt = {"AL": "basic", "QL": "proficient"}
    v = evaluate(SIX_AT_70, _nbt_rules_with_score(), TODAY, nbt)
    assert v.checks[2].result == "fail"
    assert v.outcome == "aps_only"


def test_all_nbt_held_and_met_qualifies() -> None:
    nbt = {"AL": "upper_intermediate", "QL": "proficient"}
    assert evaluate(SIX_AT_70, _nbt_rules_with_score(), TODAY, nbt).outcome == "qualifies"
