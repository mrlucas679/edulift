"""Plain-language explanation of a verdict. No AI consent means the template, never an error."""

import hashlib
from datetime import date
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.deps import Db, DbEngine, Explainer, SignedIn
from app.errors import NotFoundError, RateLimitedError
from app.explain import CheckFact, ExplanationInput, TemplateProvider, explain
from app.routers.marks import active_user, latest_marks
from app.schemas import CheckRequest
from app.verdicts import programme_verdict, subject_names

router = APIRouter(prefix="/programmes", tags=["explain"])
TEMPLATE = TemplateProvider()


class ExplanationOut(BaseModel):
    summary: str
    next_step: str
    plan_b_hint: str
    provider: Literal["template", "bedrock"]
    fallback_reason: str | None
    disclaimer: str = "Based on published minimums. The institution decides."


def _consents_ai(db: Db, user_id: str) -> bool:
    return (
        db.scalar(
            select(m.Consent.id).where(
                m.Consent.user_id == user_id,
                m.Consent.purpose == "ai_explanations",
                m.Consent.withdrawn_at.is_(None),
            )
        )
        is not None
    )


def _within_daily_limit(engine: DbEngine, subject: str) -> bool:
    try:
        rate_limit.check(engine, "explain:day", subject, limit=20, window_seconds=86_400)
    except RateLimitedError:
        return False
    return True


@router.post("/{programme_id}/explain")
def explain_verdict(
    programme_id: str,
    body: CheckRequest,
    *,
    me: SignedIn,
    db: Db,
    engine: DbEngine,
    provider: Explainer,
) -> ExplanationOut:
    rate_limit.check(engine, "explain:user", me.subject, limit=10, window_seconds=60)
    programme = db.get(m.Programme, programme_id)
    if programme is None:
        raise NotFoundError
    user = active_user(db, me.subject)
    marks = body.marks if body.marks is not None else latest_marks(db, user.id)
    if marks is None:
        raise NotFoundError("Save your marks first.")
    names = subject_names(db, marks)
    verdict = programme_verdict(db, programme, marks, names, date.today())
    institution = db.get_one(m.Institution, programme.institution_id)
    data = ExplanationInput(
        outcome=verdict.outcome,
        programme=programme.name,
        institution=institution.name,
        qualification=programme.qualification,
        closes_on=programme.closes_on.isoformat() if programme.closes_on else None,
        checks=[
            CheckFact(c.name, c.required, c.yours, c.result, c.source_url) for c in verdict.checks
        ],
    )

    if not _consents_ai(db, user.id):
        result = explain(data, TEMPLATE, TEMPLATE)
        reason: str | None = "no_consent"
    elif not _within_daily_limit(engine, me.subject):
        result = explain(data, TEMPLATE, TEMPLATE)
        reason = "daily_limit"
    else:
        result = explain(data, provider, TEMPLATE)
        reason = result.fallback_reason

    db.add(
        m.AiRequest(
            user_id_hash=hashlib.sha256(user.id.encode()).hexdigest(),
            feature="explain",
            target_id=programme.id,
            outcome_class=verdict.outcome,
            provider=result.provider,
            fallback_reason=reason,
        )
    )
    return ExplanationOut(
        summary=result.draft.summary,
        next_step=result.draft.next_step,
        plan_b_hint=result.draft.plan_b_hint,
        provider="template" if result.provider == "template" else "bedrock",
        fallback_reason=reason,
    )
