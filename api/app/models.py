from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "status IN ('onboarding', 'pending_guardian', 'active', 'restricted')",
            name="users_status_known",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), server_default="onboarding")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RateLimitHit(Base):
    __tablename__ = "rate_limit_hits"

    # sha256 of bucket + email/IP; nothing stored in clear.
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    hits: Mapped[int] = mapped_column(Integer)


# Reference data. Loaded from data/*.yaml; slugs are the keys.


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    publisher: Mapped[str] = mapped_column(Text)
    checked_on: Mapped[date | None] = mapped_column(Date)  # None: not checked yet


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20))
    aliases: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("fields.id"))


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(20))
    province: Mapped[str] = mapped_column(String(30))
    apply_url: Mapped[str] = mapped_column(Text)
    route: Mapped[str] = mapped_column(String(10))
    fee_cents: Mapped[int | None] = mapped_column(Integer)
    max_choices: Mapped[int | None] = mapped_column(Integer)
    aps_scheme: Mapped[str | None] = mapped_column(String(30))
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))

    source: Mapped[Source] = relationship(lazy="joined")
    cycles: Mapped[list["Cycle"]] = relationship(order_by="Cycle.opens_on")


class Cycle(Base):
    __tablename__ = "application_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"))
    intake_year: Mapped[int] = mapped_column(Integer)
    opens_on: Mapped[date] = mapped_column(Date)
    closes_on: Mapped[date] = mapped_column(Date)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))

    source: Mapped[Source] = relationship(lazy="joined")


class Programme(Base):
    __tablename__ = "programmes"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"))
    name: Mapped[str] = mapped_column(Text)
    qualification: Mapped[str] = mapped_column(String(20))
    field_id: Mapped[str] = mapped_column(ForeignKey("fields.id"))
    min_aps: Mapped[int | None] = mapped_column(Integer)
    aps_scheme: Mapped[str | None] = mapped_column(String(30))
    nbt: Mapped[list[Any]] = mapped_column(JSONB, default=list)  # [[{"component", "level"}]]
    notes: Mapped[str | None] = mapped_column(Text)
    floor: Mapped[dict[str, int] | None] = mapped_column(JSONB)  # {"count", "min"}
    selection: Mapped[bool] = mapped_column(Boolean, default=False)
    closes_on: Mapped[date | None] = mapped_column(Date)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))
    verified_on: Mapped[date | None] = mapped_column(Date)  # second-person check

    source: Mapped[Source] = relationship(lazy="joined")
    requirements: Mapped[list["Requirement"]] = relationship(
        order_by="(Requirement.group_no, Requirement.id)"
    )
    fps_bands: Mapped[list["FpsBand"]] = relationship(order_by="FpsBand.score.desc()")


class Requirement(Base):
    __tablename__ = "programme_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    programme_id: Mapped[str] = mapped_column(ForeignKey("programmes.id", ondelete="CASCADE"))
    group_no: Mapped[int] = mapped_column(Integer)  # same group = alternatives
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id"))
    min_percent: Mapped[int] = mapped_column(Integer)


class FpsBand(Base):
    """UCT-style admission band: a score bar plus subject groups that must also be met."""

    __tablename__ = "fps_bands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    programme_id: Mapped[str] = mapped_column(ForeignKey("programmes.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(20))
    metric: Mapped[str] = mapped_column(String(7))
    score: Mapped[int] = mapped_column(Integer)
    applies_to: Mapped[str] = mapped_column(String(20))
    # [[{"subject": ..., "min": ...}], ...]; each inner list is one group of alternatives
    requirements: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    nbt: Mapped[list[Any]] = mapped_column(JSONB, default=list)


class Handoff(Base):
    __tablename__ = "handoffs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    purpose: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))


# Learner data. Always filtered by the signed-in user's id.


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    first_name: Mapped[str | None] = mapped_column(String(60))
    birth_date: Mapped[date] = mapped_column(Date)
    province: Mapped[str | None] = mapped_column(String(30))
    # Only kept while the learner has reminders consent; cleared when it is withdrawn.
    contact_email: Mapped[str | None] = mapped_column(String(254))
    certificate: Mapped[str | None] = mapped_column(String(10))
    interests: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    granted_by: Mapped[str] = mapped_column(String(10))  # learner or guardian
    policy_version: Mapped[str] = mapped_column(String(20))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GuardianRequest(Base):
    __tablename__ = "guardian_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    guardian_name: Mapped[str] = mapped_column(String(80))
    guardian_email: Mapped[str] = mapped_column(String(254))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # sha256, never the token
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="pending")
    purposes: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    relationship: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdraw_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Mark(Base):
    __tablename__ = "mark_records"
    __table_args__ = (CheckConstraint("percent BETWEEN 0 AND 100", name="mark_percent_range"),)

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    period: Mapped[str] = mapped_column(String(20), primary_key=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id"), primary_key=True)
    percent: Mapped[int] = mapped_column(Integer)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlanTarget(Base):
    __tablename__ = "plan_targets"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    programme_id: Mapped[str] = mapped_column(ForeignKey("programmes.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20))  # bursary, loan, learnership, work
    provider: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    field_id: Mapped[str | None] = mapped_column(ForeignKey("fields.id"))
    closes_on: Mapped[date | None] = mapped_column(Date)
    criteria: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))

    source: Mapped[Source] = relationship(lazy="joined")


class SavedItem(Base):
    __tablename__ = "saved_items"
    __table_args__ = (UniqueConstraint("user_id", "target_kind", "target_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_kind: Mapped[str] = mapped_column(String(20))  # programme, opportunity
    target_id: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_kind: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), server_default="planning")
    external_reference: Mapped[str | None] = mapped_column(String(60))
    submitted_on: Mapped[date | None] = mapped_column(Date)
    offer_deadline: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, server_default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(Text)
    done: Mapped[bool] = mapped_column(Boolean, server_default="false")
    sort_order: Mapped[int] = mapped_column(Integer)


class ReminderSent(Base):
    __tablename__ = "reminders_sent"
    __table_args__ = (UniqueConstraint("user_id", "target_kind", "target_id", "threshold_days"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_kind: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(80))
    threshold_days: Mapped[int] = mapped_column(Integer)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiRequest(Base):
    """What an AI call cost and why it fell back. Never the text sent or received."""

    __tablename__ = "ai_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id_hash: Mapped[str] = mapped_column(String(64), index=True)  # sha256 of the learner id
    feature: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(80))
    outcome_class: Mapped[str] = mapped_column(String(30))
    provider: Mapped[str] = mapped_column(String(20))
    fallback_reason: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentDraft(Base):
    """A CV or motivation letter the learner chose to keep. Written only on Save."""

    __tablename__ = "document_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # cv, motivation_letter
    title: Mapped[str] = mapped_column(String(120))
    content: Mapped[str] = mapped_column(Text)
    target_kind: Mapped[str | None] = mapped_column(String(20))
    target_id: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Cleared when the learner is deleted, so the record survives without the person.
    user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(30))
    target: Mapped[str] = mapped_column(String(120), server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
