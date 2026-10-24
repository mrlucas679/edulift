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


# UCT: 2027 NSC guidelines for admission (uct.ac.za), checked 2026-10-23.
UCT_MIN_PERCENT = 40
ENGLISH = ("english_hl", "english_fal")


def _uct_aps(marks: dict[str, int], required: tuple[str, ...]) -> int:
    """Best six percentages including English and the required subjects; under 40% scores 0."""
    pts = {s: (p if p >= UCT_MIN_PERCENT else 0) for s, p in without_lo(marks).items()}
    english = max((s for s in ENGLISH if s in pts), key=lambda s: pts[s], default=None)
    must = [s for s in (english, *required) if s in pts]
    rest = sorted((v for s, v in pts.items() if s not in must and s not in ENGLISH), reverse=True)
    return sum(pts[s] for s in must) + sum(rest[: 6 - len(must)])


def uct600(marks: dict[str, int]) -> int:
    """Commerce, Engineering, Humanities and Law: the FPS is the APS, out of 600."""
    return _uct_aps(marks, ())


def uct_science(marks: dict[str, int]) -> int:
    """Science: APS with Maths and Physical Sciences, plus both again. Out of 800."""
    core = ("mathematics", "physical_sciences")
    bonus = sum(marks[s] for s in core if marks.get(s, 0) >= UCT_MIN_PERCENT)
    return _uct_aps(marks, core) + bonus


def uct_health(marks: dict[str, int]) -> int:
    """Health Sciences APS out of 600: three required subjects plus the next three best.

    Prospectus p.42: percentages of three required subjects plus next three best,
    excluding Life Orientation. The FPS adds NBT points on top, which we do not hold.
    """
    return _uct_aps(marks, ("mathematics", "physical_sciences"))


# UKZN: undergraduate prospectus 2027, p.17. Eight points for 90-100%. Six or fewer subjects
# count in full. With more, English, Maths (or Maths Literacy) and the best four others count.
UKZN_EXCELLENCE_FROM = 90
UKZN_EXCELLENCE_POINTS = 8
UKZN_COUNT_ALL_UP_TO = 6
UKZN_OTHERS = 4


def _ukzn_points(percent: int) -> int:
    return UKZN_EXCELLENCE_POINTS if percent >= UKZN_EXCELLENCE_FROM else level(percent)


def ukzn_aps(marks: dict[str, int]) -> int:
    pts = {s: _ukzn_points(p) for s, p in without_lo(marks).items()}
    if len(pts) <= UKZN_COUNT_ALL_UP_TO:
        return sum(pts.values())
    english = max((pts[s] for s in ENGLISH if s in pts), default=0)
    maths = max((pts[s] for s in ("mathematics", "maths_literacy") if s in pts), default=0)
    rest = sorted(
        (v for s, v in pts.items() if s not in (*ENGLISH, "mathematics", "maths_literacy")),
        reverse=True,
    )
    return english + maths + sum(rest[:4])


SCHEMES: dict[str, Callable[[dict[str, int]], int]] = {
    "standard_best6": best6,
    "wits_best7": wits7,
    "uct_fps": uct600,
    "uct_science": uct_science,
    "uct_health": uct_health,
    "ukzn_aps": ukzn_aps,
}


def score(scheme: str | None, marks: dict[str, int]) -> int | None:
    """None when the scheme is unknown or not verified yet."""
    fn = SCHEMES.get(scheme or "")
    return fn(marks) if fn else None
