"""APS schemes. One function per scheme; only verified schemes are listed in SCHEMES."""

from collections.abc import Callable

from eligibility.marks import LIFE_ORIENTATION, level, without_lo


def best6(marks: dict[str, int]) -> int:
    """Sum of NSC levels of the best six subjects, Life Orientation excluded. Max 42."""
    levels = sorted((level(p) for p in without_lo(marks).values()), reverse=True)
    return sum(levels[:6])


# Wits: wits.ac.za/undergraduate/entry-requirements, checked 2026-10-23.
# (lowest percent, points); below 40% scores 0.
WITS_POINTS = [(90, 8), (80, 7), (70, 6), (60, 5), (50, 4), (40, 3), (0, 0)]
WITS_LO_POINTS = [(90, 4), (80, 3), (70, 2), (60, 1), (0, 0)]
WITS_BONUS_FROM = 60
# The page says "English and Mathematics"; we read that as either English and
# Mathematics only (not Mathematical Literacy).
WITS_BONUS_SUBJECTS = {"english_hl", "english_fal", "mathematics"}


def _points(table: list[tuple[int, int]], percent: int) -> int:
    return next(pts for low, pts in table if percent >= low)


def wits7(marks: dict[str, int]) -> int:
    """Life Orientation plus the best six other subjects, using the Wits table."""
    others = []
    for subject, percent in without_lo(marks).items():
        pts = _points(WITS_POINTS, percent)
        if subject in WITS_BONUS_SUBJECTS and percent >= WITS_BONUS_FROM:
            pts += 2
        others.append(pts)
    lo = _points(WITS_LO_POINTS, marks[LIFE_ORIENTATION]) if LIFE_ORIENTATION in marks else 0
    return lo + sum(sorted(others, reverse=True)[:6])


SCHEMES: dict[str, Callable[[dict[str, int]], int]] = {
    "standard_best6": best6,
    "wits_best7": wits7,
}


def score(scheme: str | None, marks: dict[str, int]) -> int | None:
    """None when the scheme is unknown or not verified yet."""
    fn = SCHEMES.get(scheme or "")
    return fn(marks) if fn else None
