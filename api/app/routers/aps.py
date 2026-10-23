"""APS calculator. Public; nothing is stored."""

from fastapi import APIRouter
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.deps import ClientIp, Db, DbEngine
from app.errors import AppError
from app.schemas import PreviewRequest, PreviewScore
from eligibility.aps import score

router = APIRouter(prefix="/aps", tags=["aps"])


class UnknownSubjectError(AppError):
    code = "validation_failed"
    status_code = 422
    message = "Some subjects aren't recognised."


@router.post("/preview")
def preview(body: PreviewRequest, ip: ClientIp, db: Db, engine: DbEngine) -> list[PreviewScore]:
    rate_limit.check(engine, "aps:ip", ip, limit=30, window_seconds=60)
    known = set(db.scalars(select(m.Subject.id)))
    if unknown := sorted(set(body.marks) - known):
        raise UnknownSubjectError(f"Unknown subjects: {', '.join(unknown[:5])}")
    institutions = db.scalars(select(m.Institution).order_by(m.Institution.name))
    return [
        PreviewScore(
            institution_id=i.id,
            institution=i.name,
            scheme=i.aps_scheme,
            score=score(i.aps_scheme, body.marks),
        )
        for i in institutions
    ]
