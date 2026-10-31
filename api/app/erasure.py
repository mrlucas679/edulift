from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models as m


def record(db: Session, user_id: str | None, action: str, target: str = "") -> None:
    db.add(m.AuditEvent(user_id=user_id, action=action, target=target))


def export_learner(db: Session, user_id: str) -> dict[str, Any]:
    profile = db.get(m.Profile, user_id)
    consents = db.scalars(select(m.Consent).where(m.Consent.user_id == user_id))
    applications = db.scalars(select(m.Application).where(m.Application.user_id == user_id))
    marks: dict[str, dict[str, int]] = {}
    for period, subject, percent in db.execute(
        select(m.Mark.period, m.Mark.subject_id, m.Mark.percent).where(m.Mark.user_id == user_id)
    ):
        marks.setdefault(period, {})[subject] = percent
    saved = db.scalars(select(m.SavedItem).where(m.SavedItem.user_id == user_id))
    nbt = {
        c: lvl
        for c, lvl in db.execute(
            select(m.NbtRecord.component, m.NbtRecord.level).where(m.NbtRecord.user_id == user_id)
        )
    }
    drafts = db.scalars(select(m.DocumentDraft).where(m.DocumentDraft.user_id == user_id))
    plan = db.scalars(
        select(m.PlanTarget.programme_id)
        .where(m.PlanTarget.user_id == user_id)
        .order_by(m.PlanTarget.position)
    )
    credential = db.get(m.Credential, user_id)
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        # Never the password hash or recovery codes: they are secrets, not data about you.
        "username": credential.username if credential else None,
        "profile": None
        if profile is None
        else {
            "first_name": profile.first_name,
            "birth_date": profile.birth_date.isoformat(),
            "province": profile.province,
            "certificate": profile.certificate,
            "contact_email": profile.contact_email,
        },
        "consents": [
            {
                "purpose": c.purpose,
                "granted_by": c.granted_by,
                "policy_version": c.policy_version,
                "granted_at": c.granted_at.isoformat(),
                "withdrawn_at": c.withdrawn_at.isoformat() if c.withdrawn_at else None,
            }
            for c in consents
        ],
        "marks": marks,
        "nbt": nbt,
        "saved": [{"target_kind": s.target_kind, "target_id": s.target_id} for s in saved],
        "plan": list(plan),
        "applications": [_application(db, a) for a in applications],
        "drafts": [{"kind": d.kind, "title": d.title, "content": d.content} for d in drafts],
    }


def _application(db: Session, app: m.Application) -> dict[str, Any]:
    items = db.scalars(
        select(m.ChecklistItem)
        .where(m.ChecklistItem.application_id == app.id)
        .order_by(m.ChecklistItem.sort_order)
    )
    return {
        "target_kind": app.target_kind,
        "target_id": app.target_id,
        "status": app.status,
        "external_reference": app.external_reference,
        "submitted_on": app.submitted_on.isoformat() if app.submitted_on else None,
        "offer_deadline": app.offer_deadline.isoformat() if app.offer_deadline else None,
        "notes": app.notes,
        "checklist": [{"label": i.label, "done": i.done} for i in items],
    }


def erase_learner(db: Session, user: m.User, action: str) -> None:
    """Delete the learner's rows. Their username, password hash, recovery codes and
    sign-ins go with the user row; the tombstone stops a live token recreating it."""
    record(db, None, action, "learner")
    db.execute(delete(m.User).where(m.User.id == user.id))
    db.merge(m.DeletedLearner(user_id=user.id))
    db.flush()
