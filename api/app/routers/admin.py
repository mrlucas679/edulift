"""Admin pages. Totals only: an admin never sees a learner's details (least privilege)."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app import models as m
from app.demo import DEMO_PREFIX
from app.deps import Admin, Db

router = APIRouter(prefix="/admin", tags=["admin"])


class AiUse(BaseModel):
    feature: str
    provider: str
    fallback_reason: str | None
    calls: int


class Stats(BaseModel):
    accounts: int
    new_accounts_7_days: int
    demo_learners: int
    ai_calls_30_days: list[AiUse]


@router.get("/stats")
def stats(_: Admin, db: Db) -> Stats:
    now = datetime.now(UTC)
    ai = db.execute(
        select(
            m.AiRequest.feature,
            m.AiRequest.provider,
            m.AiRequest.fallback_reason,
            func.count(),
        )
        .where(m.AiRequest.created_at >= now - timedelta(days=30))
        .group_by(m.AiRequest.feature, m.AiRequest.provider, m.AiRequest.fallback_reason)
        .order_by(func.count().desc())
    )
    return Stats(
        accounts=db.scalar(select(func.count()).select_from(m.Credential)) or 0,
        new_accounts_7_days=db.scalar(
            select(func.count())
            .select_from(m.Credential)
            .where(m.Credential.created_at >= now - timedelta(days=7))
        )
        or 0,
        demo_learners=db.scalar(
            select(func.count()).select_from(m.User).where(m.User.id.startswith(DEMO_PREFIX))
        )
        or 0,
        ai_calls_30_days=[
            AiUse(feature=f, provider=p, fallback_reason=r, calls=n) for f, p, r, n in ai
        ],
    )
