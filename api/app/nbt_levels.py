"""A learner's NBT levels, or None when they have not given nbt_results consent."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m


def learner_nbt(db: Session, user_id: str) -> dict[str, str] | None:
    consented = db.scalar(
        select(m.Consent.id).where(
            m.Consent.user_id == user_id,
            m.Consent.purpose == "nbt_results",
            m.Consent.withdrawn_at.is_(None),
        )
    )
    if consented is None:
        return None
    return {c: lvl for c, lvl in db.execute(
        select(m.NbtRecord.component, m.NbtRecord.level).where(m.NbtRecord.user_id == user_id)
    )}  # fmt: skip
