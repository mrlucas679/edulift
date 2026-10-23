"""Fixed-window rate limits kept in Postgres.

In memory would be simpler, but with two API tasks behind the load balancer each one
would hand out its own allowance. Counting in the database keeps the limit honest.
"""

import hashlib
from datetime import UTC, datetime

from sqlalchemy import Engine, text

from app.errors import RateLimitedError


def check(engine: Engine, bucket: str, who: str, limit: int, window_seconds: int) -> None:
    key = hashlib.sha256(f"{bucket}:{who}".encode()).hexdigest()
    now = int(datetime.now(UTC).timestamp())
    window_start = datetime.fromtimestamp(now - now % window_seconds, UTC)

    # Own transaction on purpose: the hit has to count even if the request fails later.
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
