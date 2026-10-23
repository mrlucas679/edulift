"""NSC achievement levels."""

LIFE_ORIENTATION = "life_orientation"
MAX_PERCENT = 100

# (lowest percent, level), highest first.
LEVELS = [(80, 7), (70, 6), (60, 5), (50, 4), (40, 3), (30, 2), (0, 1)]


def level(percent: int) -> int:
    if not 0 <= percent <= MAX_PERCENT:
        raise ValueError(f"percent out of range: {percent}")
    return next(lvl for low, lvl in LEVELS if percent >= low)


def without_lo(marks: dict[str, int]) -> dict[str, int]:
    return {s: p for s, p in marks.items() if s != LIFE_ORIENTATION}
