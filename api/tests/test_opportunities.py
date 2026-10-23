from eligibility.opportunities import Criterion, Facts, assess

GAUTENG_YOUNG = [Criterion("province", ("Gauteng",)), Criterion("age_max", number=35)]


def test_all_criteria_met_qualifies() -> None:
    result = assess(GAUTENG_YOUNG, Facts("Gauteng", 18, "nsc"))
    assert result.verdict == "qualifies"


def test_one_criterion_not_met_excludes() -> None:
    result = assess(GAUTENG_YOUNG, Facts("Western Cape", 18, "nsc"))
    assert result.verdict == "not_matched"


def test_an_unknown_criterion_is_may_qualify_not_a_match() -> None:
    criteria = [*GAUTENG_YOUNG, Criterion("household_income", number=350000)]
    assert assess(criteria, Facts("Gauteng", 18, "nsc")).verdict == "may_qualify"


def test_missing_learner_fact_is_unknown_not_fail() -> None:
    result = assess(GAUTENG_YOUNG, Facts(None, 18, "nsc"))
    assert result.verdict == "may_qualify"
    assert ("province", "unknown") in result.results


def test_age_bounds_are_inclusive() -> None:
    assert assess([Criterion("age_max", number=35)], Facts("Gauteng", 35, None)).verdict == (
        "qualifies"
    )
    assert assess([Criterion("age_min", number=18)], Facts("Gauteng", 17, None)).verdict == (
        "not_matched"
    )


def test_no_published_criteria_is_never_a_firm_match() -> None:
    assert assess([], Facts("Gauteng", 18, "nsc")).verdict == "may_qualify"
