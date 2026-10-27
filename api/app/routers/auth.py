"""Sign-in: email codes, demo email/password accounts, and the one-tap demo."""

from fastapi import APIRouter, Request, Response
from sqlalchemy import Engine

from app import rate_limit
from app.auth import TokenSet
from app.config import Settings
from app.demo import DEMO_SECONDS, demo_token, new_demo_learner
from app.deps import ClientIp, DbEngine, Identities, SignedIn
from app.errors import NotFoundError
from app.schemas import (
    DemoCredentialsRequest,
    RefreshRequest,
    SignOutRequest,
    StartSignInRequest,
    StartSignInResponse,
    TokenResponse,
    VerifyCodeRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

FIFTEEN_MINUTES = 15 * 60


def _as_response(tokens: TokenSet) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.post("/start")
def start(
    body: StartSignInRequest, ip: ClientIp, engine: DbEngine, identities: Identities
) -> StartSignInResponse:
    email = body.email.lower()
    # Each call sends an email: limit per address and per IP.
    rate_limit.check(engine, "start:email", email, limit=5, window_seconds=FIFTEEN_MINUTES)
    rate_limit.check(engine, "start:ip", ip, limit=30, window_seconds=FIFTEEN_MINUTES)
    challenge = identities.send_code(email)
    return StartSignInResponse(session=challenge.session)


@router.post("/verify")
def verify(
    body: VerifyCodeRequest, ip: ClientIp, engine: DbEngine, identities: Identities
) -> TokenResponse:
    # Limit sessions per IP.
    rate_limit.check(engine, "verify:ip", ip, limit=30, window_seconds=FIFTEEN_MINUTES)
    return _as_response(identities.check_code(body.email.lower(), body.code, body.session))


@router.post("/refresh")
def refresh(body: RefreshRequest, identities: Identities) -> TokenResponse:
    return _as_response(identities.refresh(body.refresh_token))


@router.post("/sign-out", status_code=204)
def sign_out(body: SignOutRequest, _: SignedIn, identities: Identities) -> Response:
    identities.sign_out(body.refresh_token)
    return Response(status_code=204)


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


@router.post("/demo/register")
def register_demo(
    body: DemoCredentialsRequest,
    request: Request,
    ip: ClientIp,
    engine: DbEngine,
    identities: Identities,
) -> TokenResponse:
    """Create a demo account without email verification."""
    settings: Settings = request.app.state.settings
    if not settings.demo_secret:
        raise NotFoundError
    _limit_demo_attempt(body.email.lower(), ip, engine)
    return _as_response(identities.create_demo_account(body.email.lower(), body.password))


@router.post("/demo/login")
def sign_in_demo(
    body: DemoCredentialsRequest,
    request: Request,
    ip: ClientIp,
    engine: DbEngine,
    identities: Identities,
) -> TokenResponse:
    """Sign in to an existing demo account with its email and password."""
    settings: Settings = request.app.state.settings
    if not settings.demo_secret:
        raise NotFoundError
    _limit_demo_attempt(body.email.lower(), ip, engine)
    return _as_response(identities.sign_in_demo(body.email.lower(), body.password))


def _limit_demo_attempt(email: str, ip: str, engine: Engine) -> None:
    # Bound credential guessing by both account name and client address.
    rate_limit.check(engine, "demo:email", email, limit=10, window_seconds=FIFTEEN_MINUTES)
    rate_limit.check(engine, "demo:ip", ip, limit=30, window_seconds=FIFTEEN_MINUTES)
