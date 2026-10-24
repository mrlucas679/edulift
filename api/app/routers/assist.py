import hashlib
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app import models as m
from app import rate_limit
from app.assist import (
    Record,
    TemplateDraft,
    ask,
    generate_draft,
    retrieve,
)
from app.deps import Asker, Db, DbEngine, Drafter, SignedIn
from app.errors import NotFoundError, RateLimitedError
from app.routers.marks import active_user, latest_marks
from app.schemas import Request
from app.tracking import target_summary

router = APIRouter(tags=["assist"])
DRAFT_LABEL = "Draft — check and edit before you send."


class AskIn(Request):
    question: str = Field(min_length=3, max_length=300)


class CitedOut(BaseModel):
    id: str
    title: str
    url: str | None


class AskOut(BaseModel):
    answer: str
    cited: list[CitedOut]
    provider: str
    fallback_reason: str | None


class DraftIn(Request):
    kind: Literal["cv", "motivation_letter"]
    target_kind: Literal["programme", "opportunity"] | None = None
    target_id: str | None = Field(default=None, max_length=80)
    facts: str = Field(min_length=1, max_length=3000)


class DraftOut(BaseModel):
    text: str
    label: str = DRAFT_LABEL
    provider: str
    fallback_reason: str | None


class SaveDraftIn(Request):
    kind: Literal["cv", "motivation_letter"]
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=10_000)
    target_kind: Literal["programme", "opportunity"] | None = None
    target_id: str | None = Field(default=None, max_length=80)


class SavedDraftOut(BaseModel):
    id: int
    kind: str
    title: str
    content: str


def _consents_ai_writing(db: Db, user_id: str) -> bool:
    return (
        db.scalar(
            select(m.Consent.id).where(
                m.Consent.user_id == user_id,
                m.Consent.purpose == "ai_writing",
                m.Consent.withdrawn_at.is_(None),
            )
        )
        is not None
    )


def _within_limits(engine: DbEngine, bucket: str, who: str, per_minute: int, per_day: int) -> bool:
    try:
        rate_limit.check(engine, f"{bucket}:min", who, limit=per_minute, window_seconds=60)
        rate_limit.check(engine, f"{bucket}:day", who, limit=per_day, window_seconds=86_400)
    except RateLimitedError:
        return False
    return True


def _log(
    db: Db, *, user_id: str, feature: str, target: str, provider: str, reason: str | None
) -> None:
    db.add(
        m.AiRequest(
            user_id_hash=hashlib.sha256(user_id.encode()).hexdigest(),
            feature=feature,
            target_id=target,
            outcome_class="-",
            provider=provider,
            fallback_reason=reason,
        )
    )


@router.post("/ask")
def ask_question(body: AskIn, *, me: SignedIn, db: Db, engine: DbEngine, asker: Asker) -> AskOut:
    user = active_user(db, me.subject)
    records: list[Record] = []
    if not _consents_ai_writing(db, user.id):
        answer, provider, reason = ask(body.question, [], asker)
        reason = reason or "no_consent"
        records = []
    elif not _within_limits(engine, "ask", me.subject, per_minute=10, per_day=30):
        answer, provider, reason = ask(body.question, [], asker)
        reason = "daily_limit"
        records = []
    else:
        records = retrieve(db, body.question)
        answer, provider, reason = ask(body.question, records, asker)
    _log(db, user_id=user.id, feature="ask", target="-", provider=provider, reason=reason)
    by_id = {r.id: r for r in records}
    cited = [
        CitedOut(id=c, title=by_id[c].title, url=by_id[c].url)
        for c in answer.cited_ids
        if c in by_id
    ]
    return AskOut(answer=answer.answer, cited=cited, provider=provider, fallback_reason=reason)


@router.post("/me/drafts/generate")
def generate(
    body: DraftIn, *, me: SignedIn, db: Db, engine: DbEngine, drafter: Drafter
) -> DraftOut:
    user = active_user(db, me.subject)
    marks = latest_marks(db, user.id)
    if marks is None:
        raise NotFoundError("Save your marks first.")
    if body.target_kind and body.target_id:
        target_summary(db, body.target_kind, body.target_id)
    template = TemplateDraft()
    if not _consents_ai_writing(db, user.id):
        text, provider, reason = generate_draft(body.kind, body.facts, marks, template)
        reason = reason or "no_consent"
    elif not _within_limits(engine, "draft", me.subject, per_minute=5, per_day=10):
        text, provider, reason = generate_draft(body.kind, body.facts, marks, template)
        reason = "daily_limit"
    else:
        text, provider, reason = generate_draft(body.kind, body.facts, marks, drafter)
    _log(
        db,
        user_id=user.id,
        feature="draft",
        target=body.target_id or "-",
        provider=provider,
        reason=reason,
    )
    return DraftOut(text=text, provider=provider, fallback_reason=reason)


@router.post("/me/drafts", status_code=201)
def save_draft(body: SaveDraftIn, me: SignedIn, db: Db) -> SavedDraftOut:
    user = active_user(db, me.subject)
    if body.target_kind and body.target_id:
        target_summary(db, body.target_kind, body.target_id)
    row = m.DocumentDraft(
        user_id=user.id,
        kind=body.kind,
        title=body.title,
        content=body.content,
        target_kind=body.target_kind,
        target_id=body.target_id,
    )
    db.add(row)
    db.flush()
    return SavedDraftOut(id=row.id, kind=row.kind, title=row.title, content=row.content)


@router.get("/me/drafts")
def list_drafts(me: SignedIn, db: Db) -> list[SavedDraftOut]:
    user = active_user(db, me.subject)
    rows = db.scalars(
        select(m.DocumentDraft)
        .where(m.DocumentDraft.user_id == user.id)
        .order_by(m.DocumentDraft.id)
    )
    return [SavedDraftOut(id=r.id, kind=r.kind, title=r.title, content=r.content) for r in rows]
