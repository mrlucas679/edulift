"""Sign-in: username and password, recovery codes, and the one-tap demo.

Built to the OWASP Authentication and Session Management cheat sheets: one error for a
wrong username or password, attempts limited per username and per address, Argon2id
hashes, and every sign-in ended when the password changes.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models as m
from app import passwords, rate_limit, tokens
from app.config import Settings
from app.demo import DEMO_SECONDS, demo_token, new_demo_learner
from app.deps import AppSettings, ClientIp, Db, DbEngine, SignedIn
from app.errors import (
    InvalidCredentialsError,
    InvalidRecoveryError,
    NotAllowedError,
    NotFoundError,
    UnauthenticatedError,
    UsernameTakenError,
    WeakPasswordError,
)
from app.schemas import (
    ChangePasswordRequest,
    Credentials,
    NewAccount,
    NewCodesRequest,
    RecoverRequest,
    RecoveryCodes,
    RefreshRequest,
    SignOutRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

FIFTEEN_MINUTES = 15 * 60
HOUR = 60 * 60


def _cookie_name(settings: Settings) -> str:
    # __Host- makes the browser refuse it unless Secure, Path=/ and no Domain (OWASP).
    return "__Host-edulift_refresh" if settings.deployed else "edulift_refresh"


def _reply(
    response: Response, settings: Settings, signed_in: tokens.TokenSet, use_cookie: bool
) -> TokenResponse:
    if not use_cookie:
        return TokenResponse(
            access_token=signed_in.access_token,
            refresh_token=signed_in.refresh_token,
            expires_in=signed_in.expires_in,
        )
    response.set_cookie(
        _cookie_name(settings),
        signed_in.refresh_token,
        max_age=tokens.SIGN_IN_HOURS * HOUR,
        path="/",
        secure=settings.deployed,
        httponly=True,
        samesite="strict",
    )
    return TokenResponse(
        access_token=signed_in.access_token, refresh_token=None, expires_in=signed_in.expires_in
    )


def _refresh_token(request: Request, settings: Settings, sent: str | None) -> str | None:
    return sent or request.cookies.get(_cookie_name(settings))


def _require_strong(password: str, username: str) -> None:
    reason = passwords.weak_reason(password, username)
    if reason:
        raise WeakPasswordError(reason)


def _new_codes(db: Session, user_id: str) -> list[str]:
    db.execute(delete(m.RecoveryCode).where(m.RecoveryCode.user_id == user_id))
    codes = passwords.new_recovery_codes()
    db.add_all(m.RecoveryCode(code_hash=passwords.code_hash(c), user_id=user_id) for c in codes)
    return codes


def _credential(db: Session, username: str) -> m.Credential | None:
    return db.scalars(select(m.Credential).where(m.Credential.username == username.lower())).first()


@router.post("/register", status_code=201)
def register(
    body: Credentials,
    response: Response,
    *,
    ip: ClientIp,
    db: Db,
    engine: DbEngine,
    settings: AppSettings,
) -> NewAccount:
    rate_limit.check(engine, "register:ip", ip, limit=10, window_seconds=HOUR)
    username = body.username.lower()
    _require_strong(body.password, username)
    user_id = str(uuid.uuid4())
    try:
        with db.begin_nested():
            db.add(m.User(id=user_id))
            db.flush()
            db.add(
                m.Credential(
                    user_id=user_id,
                    username=username,
                    password_hash=passwords.hash_password(body.password),
                )
            )
            db.flush()
    except IntegrityError as err:
        raise UsernameTakenError from err
    codes = _new_codes(db, user_id)
    signed_in = tokens.sign_in(db, settings.auth_secret, user_id)
    reply = _reply(response, settings, signed_in, body.use_cookie)
    return NewAccount(**reply.model_dump(), recovery_codes=codes)


@router.post("/login")
def login(
    body: Credentials,
    response: Response,
    *,
    ip: ClientIp,
    db: Db,
    engine: DbEngine,
    settings: AppSettings,
) -> TokenResponse:
    # Slow guessing down without locking anyone out.
    rate_limit.check(engine, "login:user", body.username.lower(), 10, FIFTEEN_MINUTES)
    rate_limit.check(engine, "login:ip", ip, limit=30, window_seconds=FIFTEEN_MINUTES)
    credential = _credential(db, body.username)
    ok, new_hash = passwords.check_password(
        credential.password_hash if credential else None, body.password
    )
    if credential is None or not ok:
        raise InvalidCredentialsError
    if new_hash:
        credential.password_hash = new_hash
    signed_in = tokens.sign_in(db, settings.auth_secret, credential.user_id)
    return _reply(response, settings, signed_in, body.use_cookie)


@router.post("/recover")
def recover(
    body: RecoverRequest,
    response: Response,
    *,
    ip: ClientIp,
    db: Db,
    engine: DbEngine,
    settings: AppSettings,
) -> TokenResponse:
    """A forgotten password: one recovery code sets a new one and ends every sign-in."""
    rate_limit.check(engine, "recover:user", body.username.lower(), 5, FIFTEEN_MINUTES)
    rate_limit.check(engine, "recover:ip", ip, limit=20, window_seconds=FIFTEEN_MINUTES)
    # Checked first, so a weak password says nothing about whether the code was right.
    _require_strong(body.new_password, body.username.lower())
    credential = _credential(db, body.username)
    code = db.get(m.RecoveryCode, passwords.code_hash(body.code), with_for_update=True)
    if credential is None or code is None or code.user_id != credential.user_id:
        raise InvalidRecoveryError
    db.delete(code)  # each code works once
    credential.password_hash = passwords.hash_password(body.new_password)
    credential.changed_at = datetime.now(UTC)
    tokens.sign_out_everywhere(db, credential.user_id)
    signed_in = tokens.sign_in(db, settings.auth_secret, credential.user_id)
    return _reply(response, settings, signed_in, body.use_cookie)


@router.post("/refresh")
def refresh(
    body: RefreshRequest, request: Request, response: Response, db: Db, settings: AppSettings
) -> TokenResponse:
    sent = _refresh_token(request, settings, body.refresh_token)
    if not sent:
        raise UnauthenticatedError
    return _reply(response, settings, tokens.renew(db, settings.auth_secret, sent), body.use_cookie)


@router.post("/sign-out", status_code=204)
def sign_out(
    body: SignOutRequest, request: Request, _: SignedIn, db: Db, settings: AppSettings
) -> Response:
    sent = _refresh_token(request, settings, body.refresh_token)
    if sent:
        tokens.sign_out(db, sent)
    response = Response(status_code=204)
    response.delete_cookie(_cookie_name(settings), path="/", secure=settings.deployed)
    return response


def _own_credential(db: Session, me: SignedIn, password: str) -> m.Credential:
    credential = db.get(m.Credential, me.subject)
    if credential is None:
        raise NotAllowedError("Demo learners don't have a password.")
    ok, _ = passwords.check_password(credential.password_hash, password)
    if not ok:
        raise InvalidCredentialsError("That isn't your current password.")
    return credential


@router.post("/password")
def change_password(
    body: ChangePasswordRequest,
    response: Response,
    *,
    me: SignedIn,
    db: Db,
    engine: DbEngine,
    settings: AppSettings,
) -> TokenResponse:
    """A new password ends every other sign-in."""
    rate_limit.check(engine, "password:user", me.subject, 10, FIFTEEN_MINUTES)
    credential = _own_credential(db, me, body.current_password)
    _require_strong(body.new_password, credential.username)
    credential.password_hash = passwords.hash_password(body.new_password)
    credential.changed_at = datetime.now(UTC)
    tokens.sign_out_everywhere(db, me.subject)
    signed_in = tokens.sign_in(db, settings.auth_secret, me.subject)
    return _reply(response, settings, signed_in, body.use_cookie)


@router.post("/recovery-codes")
def replace_codes(body: NewCodesRequest, me: SignedIn, db: Db, engine: DbEngine) -> RecoveryCodes:
    """Ten new codes; the old ones stop working."""
    rate_limit.check(engine, "password:user", me.subject, 10, FIFTEEN_MINUTES)
    _own_credential(db, me, body.current_password)
    return RecoveryCodes(recovery_codes=_new_codes(db, me.subject))


@router.post("/demo")
def try_demo(request: Request, ip: ClientIp, engine: DbEngine) -> TokenResponse:
    """Sign in as a brand-new demo learner. Off unless DEMO_SECRET is set."""
    settings: Settings = request.app.state.settings
    if not settings.demo_secret:
        raise NotFoundError
    # Each tap makes a learner: limit per IP.
    rate_limit.check(engine, "demo:new", ip, limit=20, window_seconds=FIFTEEN_MINUTES)
    with request.app.state.sessions() as db, db.begin():
        subject = new_demo_learner(db)
    return TokenResponse(
        access_token=demo_token(settings.demo_secret, subject),
        refresh_token=None,
        expires_in=DEMO_SECONDS,
    )
