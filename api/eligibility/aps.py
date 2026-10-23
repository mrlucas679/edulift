"""APS schemes. One function per scheme; only verified schemes are listed in SCHEMES."""

from collections.abc import Callable

from eligibility.marks import level, without_lo


def best6(marks: dict[str, int]) -> int:
    """Sum of NSC levels of the best six subjects, Life Orientation excluded. Max 42."""
    levels = sorted((level(p) for p in without_lo(marks).values()), reverse=True)
    return sum(levels[:6])


SCHEMES: dict[str, Callable[[dict[str, int]], int]] = {"standard_best6": best6}


def score(scheme: str | None, marks: dict[str, int]) -> int | None:
    """None when the scheme is unknown or not verified yet."""
    fn = SCHEMES.get(scheme or "")
    return fn(marks) if fn else None
