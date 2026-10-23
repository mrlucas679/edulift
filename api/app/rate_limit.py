"""Fixed-window rate limits in Postgres, shared by all API tasks."""

import hashlib
from datetime import UTC, datetime

from sqlalchemy import Engine, text

from app.errors import RateLimitedError


def now() -> datetime:
    return datetime.now(UTC)


def check(engine: Engine, bucket: str, who: str, limit: int, window_seconds: int) -> None:
    key = hashlib.sha256(f"{bucket}:{who}".encode()).hexdigest()
    ts = int(now().timestamp())
    window_start = datetime.fromtimestamp(ts - ts % window_seconds, UTC)

    # Own transaction so the hit counts even if the request fails.
    with engine.begin() as db:
        db.execute(
            text("DELETE FROM rate_limit_hits WHERE key = :key AND window_start < :start"),
            {"key": key, "start": window_start},
        )
        hits = db.execute(
            text(
                "INSERT INTO rate_limit_hits (key, window_start, hits) VALUES (:key, :start, 1) "
                "ON CONFLICT (key, window_start) "
                "DO UPDATE SET hits = rate_limit_hits.hits + 1 RETURNING hits"
            ),
            {"key": key, "start": window_start},
        ).scalar_one()

    if hits > limit:
        raise RateLimitedError
