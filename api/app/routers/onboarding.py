"""Profile, age check, consents and guardian approval."""

import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Response
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app import models as m
from app import rate_limit
from app.accounts import ensure_account
from app.age import ADULT, MIN_AGE, age_on
from app.demo import DEMO_PREFIX
from app.deps import AppSettings, ClientIp, Db, DbEngine, Identities, Mail, SignedIn
from app.erasure import export_learner
from app.errors import AppError, NotFoundError, UpstreamUnavailableError
from app.schemas import (
    ConsentRequest,
    GuardianDecision,
    GuardianRequestIn,
    GuardianView,
    MeDetail,
    ProfileIn,
)

router = APIRouter(tags=["onboarding"])

POLICY = "2026-10"
LINK_HOURS = 72
OPTIONAL = {"ai_explanations", "ai_writing", "reminders", "nbt_results", "low_data"}


class TooYoungError(AppError):
    code = "too_young"
    status_code = 403
    message = "EduLift accounts are for people aged 17 and over."


class UnknownInterestError(AppError):
    code = "validation_failed"
    status_code = 422
    message = "Some interests aren't recognised."


class NotAllowedError(AppError):
    code = "not_allowed"
    status_code = 403
    message = "That isn't allowed."


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _active_purposes(db: Session, user_id: str, granted_by: str | None = None) -> set[str]:
    query = select(m.Consent.purpose).where(
        m.Consent.user_id == user_id, m.Consent.withdrawn_at.is_(None)
    )
    if granted_by is not None:
        query = query.where(m.Consent.granted_by == granted_by)
    return set(db.scalars(query))


def _guardian_withdrew(db: Session, user_id: str) -> bool:
    return (
        db.scalar(
            select(m.GuardianRequest.id).where(
                m.GuardianRequest.user_id == user_id,
                m.GuardianRequest.withdrawn_at.is_not(None),
            )
        )
        is not None
    )


def reconfirm_purposes(db: Session, user: m.User, today: date) -> list[str]:
    """At 18 a guardian's choices are only a starting point: the learner confirms them."""
    profile = db.get(m.Profile, user.id)
    if profile is None or age_on(profile.birth_date, today) < ADULT:
        return []
    return sorted(_active_purposes(db, user.id, granted_by="guardian"))


def _guardian_allowed(db: Session, user_id: str) -> set[str] | None:
    """Purposes the guardian approved, or None if no guardian approval exists."""
    req = db.scalars(
        select(m.GuardianRequest).where(
            m.GuardianRequest.user_id == user_id,
            m.GuardianRequest.status == "approved",
            m.GuardianRequest.withdrawn_at.is_(None),
        )
    ).first()
    return set(req.purposes) | {"account"} if req else None


def _refresh_status(db: Session, user: m.User) -> None:
    profile = db.get(m.Profile, user.id)
    if profile is None:
        user.status = "onboarding"
        return
    age = age_on(profile.birth_date, date.today())
    if age < ADULT and _guardian_allowed(db, user.id) is None:
        user.status = "restricted" if _guardian_withdrew(db, user.id) else "pending_guardian"
    elif age >= ADULT and "account" not in _active_purposes(db, user.id, granted_by="learner"):
        user.status = "onboarding"
    elif "account" in _active_purposes(db, user.id):
        user.status = "active"
    else:
        user.status = "onboarding"


def _me(db: Session, user: m.User) -> MeDetail:
    # Age moves on its own, so the status follows the birthday on every read.
    _refresh_status(db, user)
    profile = db.get(m.Profile, user.id)
    return MeDetail(
        id=user.id,
        status=user.status,
        created_at=user.created_at,
        first_name=profile.first_name if profile else None,
        birth_date=profile.birth_date if profile else None,
        province=profile.province if profile else None,
        certificate=profile.certificate if profile else None,
        consents=sorted(_active_purposes(db, user.id)),
        interests=list(profile.interests) if profile else [],
        reconfirm=reconfirm_purposes(db, user, date.today()),
    )


@router.get("/me/details")
def details(me: SignedIn, db: Db) -> MeDetail:
    return _me(db, ensure_account(db, me.subject))


@router.put("/me/profile")
def save_profile(body: ProfileIn, me: SignedIn, db: Db, identities: Identities) -> MeDetail:
    user = ensure_account(db, me.subject)
    if age_on(body.birth_date, date.today()) < MIN_AGE:
        # Keep nothing: remove the account here and at Cognito.
        db.delete(user)
        db.flush()
        identities.delete_user(me.subject)
        raise TooYoungError
    profile = db.get(m.Profile, user.id) or m.Profile(user_id=user.id)
    for field, value in body.model_dump(exclude_unset=True, exclude={"interests"}).items():
        setattr(profile, field, value)
    if body.interests is not None:
        known = set(db.scalars(select(m.Field.id)))
        if set(body.interests) - known:
            raise UnknownInterestError
        profile.interests = body.interests
    db.add(profile)
    db.flush()
    _refresh_status(db, user)
    return _me(db, user)


@router.post("/me/consents")
def set_consent(body: ConsentRequest, me: SignedIn, db: Db) -> MeDetail:
    user = ensure_account(db, me.subject)
    if body.granted:
        if db.get(m.Profile, user.id) is None:
            raise NotAllowedError("Add your date of birth first.")
        allowed = _guardian_allowed(db, user.id)
        profile = db.get_one(m.Profile, user.id)
        if age_on(profile.birth_date, date.today()) < ADULT and (
            allowed is None or body.purpose not in allowed
        ):
            raise NotAllowedError("Your guardian hasn't allowed this.")
        if body.purpose == "reminders":
            if body.contact_email is None:
                raise NotAllowedError("Give the email address reminders should go to.")
            profile.contact_email = body.contact_email.lower()
        if body.purpose not in _active_purposes(db, user.id, granted_by="learner"):
            if age_on(profile.birth_date, date.today()) >= ADULT:
                # At 18 the learner takes over the guardian's choice for this purpose.
                db.execute(
                    update(m.Consent)
                    .where(
                        m.Consent.user_id == user.id,
                        m.Consent.purpose == body.purpose,
                        m.Consent.granted_by == "guardian",
                        m.Consent.withdrawn_at.is_(None),
                    )
                    .values(withdrawn_at=datetime.now(UTC))
                )
            db.add(
                m.Consent(
                    user_id=user.id,
                    purpose=body.purpose,
                    granted_by="learner",
                    policy_version=POLICY,
                )
            )
    else:
        learner_profile = db.get(m.Profile, user.id)
        if body.purpose == "reminders" and learner_profile is not None:
            learner_profile.contact_email = None
        if body.purpose == "nbt_results":
            db.execute(delete(m.NbtRecord).where(m.NbtRecord.user_id == user.id))
        db.execute(
            update(m.Consent)
            .where(
                m.Consent.user_id == user.id,
                m.Consent.purpose == body.purpose,
                m.Consent.withdrawn_at.is_(None),
            )
            .values(withdrawn_at=datetime.now(UTC))
        )
    db.flush()
    _refresh_status(db, user)
    return _me(db, user)


@router.post("/me/guardian", status_code=204)
def ask_guardian(
    body: GuardianRequestIn,
    *,
    me: SignedIn,
    db: Db,
    engine: DbEngine,
    identities: Identities,
    mail: Mail,
    settings: AppSettings,
) -> Response:
    if not settings.app_url:
        raise UpstreamUnavailableError("Guardian emails aren't switched on yet.")
    rate_limit.check(engine, "guardian:user", me.subject, limit=3, window_seconds=86_400)
    user = ensure_account(db, me.subject)
    if user.status != "pending_guardian":
        raise NotAllowedError("A guardian's approval isn't needed for this account.")
    guardian_email = body.guardian_email.lower()
    # Demo learners have no email of their own to compare with.
    if (
        not me.subject.startswith(DEMO_PREFIX)
        and guardian_email == identities.email_of(me.subject).lower()
    ):
        raise NotAllowedError("Use your parent or guardian's own email address.")

    db.execute(
        delete(m.GuardianRequest).where(
            m.GuardianRequest.user_id == user.id, m.GuardianRequest.status == "pending"
        )
    )
    token = secrets.token_urlsafe(32)
    db.add(
        m.GuardianRequest(
            user_id=user.id,
            guardian_name=body.guardian_name,
            guardian_email=guardian_email,
            token_hash=_hash(token),
            expires_at=datetime.now(UTC) + timedelta(hours=LINK_HOURS),
        )
    )
    profile = db.get_one(m.Profile, user.id)
    learner = profile.first_name or "Your child"
    link = f"{settings.app_url}/guardian/{token}"
    body_text = _guardian_email(body.guardian_name, learner, link)
    mail.send(guardian_email, f"{learner} wants to use EduLift", body_text)
    return Response(status_code=204)


def _guardian_email(guardian: str, learner: str, link: str) -> str:
    return (
        f"Hi {guardian}.\n\n"
        f"{learner} (17) wants to use EduLift to see which universities, colleges, "
        "funding and jobs they qualify for. Because they are under 18, the law needs "
        "your permission first.\n\n"
        f"Read what we collect, then approve or decline:\n{link}\n\n"
        f"The link works once and expires in {LINK_HOURS} hours. If you don't know "
        f"{learner}, ignore this email and nothing will be kept."
    )


def _open_request(db: Session, token: str) -> m.GuardianRequest:
    req = db.scalars(
        select(m.GuardianRequest).where(m.GuardianRequest.token_hash == _hash(token))
    ).first()
    # Wrong, used and expired links all look the same.
    if req is None or req.status != "pending" or req.expires_at < datetime.now(UTC):
        raise NotFoundError("This link has expired or was already used. Ask for a new one.")
    return req


@router.get("/guardian/{token}")
def view_request(token: str, ip: ClientIp, db: Db, engine: DbEngine) -> GuardianView:
    rate_limit.check(engine, "guardian:ip", ip, limit=10, window_seconds=60)
    req = _open_request(db, token)
    profile = db.get(m.Profile, req.user_id)
    return GuardianView(
        learner_first_name=(profile.first_name if profile else None) or "Your child",
        guardian_name=req.guardian_name,
        optional_purposes=sorted(OPTIONAL),
    )


@router.post("/guardian/{token}", response_model=None)
def decide(
    token: str,
    body: GuardianDecision,
    *,
    ip: ClientIp,
    db: Db,
    engine: DbEngine,
    mail: Mail,
    settings: AppSettings,
) -> Response | dict[str, str]:
    rate_limit.check(engine, "guardian:ip", ip, limit=10, window_seconds=60)
    req = _open_request(db, token)
    req.decided_at = datetime.now(UTC)
    user = db.get_one(m.User, req.user_id)
    if body.decision == "decline":
        # Declined: keep nothing about the learner but the bare account.
        req.status = "declined"
        db.execute(delete(m.Profile).where(m.Profile.user_id == user.id))
        user.status = "onboarding"
        return Response(status_code=204)

    req.status = "approved"
    req.relationship = body.relationship
    req.purposes = sorted(set(body.purposes) & OPTIONAL)
    for purpose in ["account", *req.purposes]:
        db.add(
            m.Consent(
                user_id=user.id, purpose=purpose, granted_by="guardian", policy_version=POLICY
            )
        )
    withdraw_token = secrets.token_urlsafe(32)
    req.withdraw_token_hash = _hash(withdraw_token)
    db.flush()
    _refresh_status(db, user)
    if settings.app_url:
        profile = db.get_one(m.Profile, user.id)
        link = f"{settings.app_url}/guardian/withdraw/{withdraw_token}"
        mail.send(
            req.guardian_email,
            "You can change your decision any time",
            _confirmation_email(req.guardian_name, profile.first_name or "Your child", link),
        )
    # The guardian is still on the approve page, so it gets the same link there.
    return {"withdraw_token": withdraw_token}


def _confirmation_email(guardian: str, learner: str, link: str) -> str:
    return (
        f"Hi {guardian}.\n\n"
        f"Thank you. {learner} can now use EduLift with the choices you made.\n\n"
        f"To withdraw your approval at any time, use this link:\n{link}\n\n"
        f"If you withdraw, {learner} can only browse until they turn 18."
    )


class WithdrawalView(BaseModel):
    learner_first_name: str
    guardian_name: str


def _open_withdrawal(db: Session, token: str) -> m.GuardianRequest:
    req = db.scalars(
        select(m.GuardianRequest).where(m.GuardianRequest.withdraw_token_hash == _hash(token))
    ).first()
    if req is None or req.withdrawn_at is not None:
        raise NotFoundError("This link is no longer valid.")
    return req


@router.get("/guardian/withdraw/{token}")
def view_withdrawal(token: str, ip: ClientIp, db: Db, engine: DbEngine) -> WithdrawalView:
    rate_limit.check(engine, "guardian:ip", ip, limit=10, window_seconds=60)
    req = _open_withdrawal(db, token)
    profile = db.get(m.Profile, req.user_id)
    return WithdrawalView(
        learner_first_name=(profile.first_name if profile else None) or "Your child",
        guardian_name=req.guardian_name,
    )


@router.get("/guardian/withdraw/{token}/export")
def export_for_guardian(token: str, ip: ClientIp, db: Db, engine: DbEngine) -> dict[str, object]:
    """What we hold about the learner, for the guardian who approved it."""
    rate_limit.check(engine, "guardian:ip", ip, limit=10, window_seconds=60)
    req = _open_withdrawal(db, token)
    return export_learner(db, req.user_id)


@router.post("/guardian/withdraw/{token}", status_code=204)
def withdraw(token: str, ip: ClientIp, db: Db, engine: DbEngine) -> Response:
    rate_limit.check(engine, "guardian:ip", ip, limit=10, window_seconds=60)
    req = _open_withdrawal(db, token)
    now = datetime.now(UTC)
    req.withdrawn_at = now
    req.withdraw_token_hash = None  # the link works once
    user = db.get_one(m.User, req.user_id)
    db.execute(
        update(m.Consent)
        .where(
            m.Consent.user_id == user.id,
            m.Consent.granted_by == "guardian",
            m.Consent.withdrawn_at.is_(None),
        )
        .values(withdrawn_at=now)
    )
    db.flush()
    _refresh_status(db, user)
    return Response(status_code=204)
