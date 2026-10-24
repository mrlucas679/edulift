from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.errors import NotFoundError

TargetKind = str  # "programme" or "opportunity"

DEFAULT_CHECKLIST = (
    "Certified copy of your ID",
    "Grade 11 final results",
    "Grade 12 June results",
    "Confirmation email saved",
    "Residence application",
)
DEADLINE_SOON_DAYS = 7


def target_summary(db: Session, kind: TargetKind, target_id: str) -> tuple[str, date | None]:
    """Name and closing date of a programme or opportunity. Raises NotFoundError if missing."""
    if kind == "programme":
        programme = db.get(m.Programme, target_id)
        if programme is None:
            raise NotFoundError
        closes = programme.closes_on
        if closes is None:
            closes = db.scalar(
                select(m.Cycle.closes_on)
                .where(m.Cycle.institution_id == programme.institution_id)
                .order_by(m.Cycle.intake_year.desc())
            )
        return programme.name, closes
    opportunity = db.get(m.Opportunity, target_id)
    if opportunity is None:
        raise NotFoundError
    return opportunity.name, opportunity.closes_on


def needs_reference(application: m.Application) -> bool:
    return application.status == "submitted" and not application.external_reference


def deadline_soon(application: m.Application, today: date) -> bool:
    if application.offer_deadline is None:
        return False
    return 0 <= (application.offer_deadline - today).days <= DEADLINE_SOON_DAYS


def official_url(db: Session, kind: TargetKind, target_id: str) -> str:
    """Where the learner goes to apply: the institution's site or the opportunity's page."""
    if kind == "programme":
        programme = db.get(m.Programme, target_id)
        if programme is None:
            raise NotFoundError
        return db.get_one(m.Institution, programme.institution_id).apply_url
    opportunity = db.get(m.Opportunity, target_id)
    if opportunity is None:
        raise NotFoundError
    return opportunity.url
