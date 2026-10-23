from datetime import date

from eligibility.plan_b import Candidate, Route, Target, plan_b

TARGET = Target("uj.bcom", "uj", "commerce", "degree")
PROVINCE = "Gauteng"


def offer(
    pid: str,
    *,
    institution: str = "uj",
    province: str = "Gauteng",
    field: str = "commerce",
    qualification: str = "degree",
    outcome: str = "qualifies",
    window: str = "open",
    closes: date | None = date(2027, 6, 1),
) -> Candidate:
    return Candidate(pid, pid, institution, province, field, qualification, outcome, window, closes)


def route(routes: list[Route], key: str) -> list[str]:
    [found] = [r for r in routes if r.key == key]
    return [c.programme_id for c in found.items]


def test_easier_entry_follows_the_ladder() -> None:
    candidates = [
        offer("uj.diploma", qualification="diploma"),
        offer("uj.extended", qualification="extended_degree"),
        offer("uj.cert", qualification="higher_certificate"),
    ]
    routes = plan_b(TARGET, candidates, PROVINCE)
    assert route(routes, "easier_entry") == ["uj.extended", "uj.diploma", "uj.cert"]


def test_the_target_is_never_its_own_alternative() -> None:
    routes = plan_b(TARGET, [offer("uj.bcom", qualification="diploma")], PROVINCE)
    assert route(routes, "easier_entry") == []


def test_only_qualifying_outcomes_are_offered() -> None:
    candidates = [offer("uj.dip", qualification="diploma", outcome="not_eligible")]
    assert route(plan_b(TARGET, candidates, PROVINCE), "easier_entry") == []


def test_open_before_closed_then_closing_soonest() -> None:
    candidates = [
        offer("wits.a", institution="wits", window="closed", closes=date(2026, 1, 1)),
        offer("up.b", institution="up", closes=date(2027, 9, 1)),
        offer("tut.c", institution="tut", closes=date(2027, 3, 1)),
    ]
    assert route(plan_b(TARGET, candidates, PROVINCE), "same_field") == [
        "tut.c",
        "up.b",
        "wits.a",
    ]


def test_learners_province_comes_first_among_equals() -> None:
    candidates = [
        offer("ukzn.x", institution="ukzn", province="KwaZulu-Natal", closes=date(2027, 3, 1)),
        offer("tut.y", institution="tut", province="Gauteng", closes=date(2027, 3, 1)),
    ]
    assert route(plan_b(TARGET, candidates, PROVINCE), "same_field") == ["tut.y", "ukzn.x"]


def test_each_route_stops_at_three() -> None:
    candidates = [offer(f"p{i}", institution=f"i{i}") for i in range(5)]
    assert len(route(plan_b(TARGET, candidates, PROVINCE), "same_field")) == 3


def test_tvet_route_takes_nc_v_and_n4_only() -> None:
    candidates = [
        offer("cj.nc", institution="cj", qualification="nc_v"),
        offer("cj.n4", institution="cj", qualification="n4"),
        offer("cj.deg", institution="cj", qualification="degree"),
    ]
    assert sorted(route(plan_b(TARGET, candidates, PROVINCE), "tvet")) == ["cj.n4", "cj.nc"]


def test_an_empty_route_says_why() -> None:
    [found] = [r for r in plan_b(TARGET, [], PROVINCE) if r.key == "tvet"]
    assert found.items == []
    assert "NC(V) or N4" in found.empty_reason
