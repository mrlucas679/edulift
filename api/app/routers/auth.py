"""Email-code sign-in. The app only ever talks to us; we talk to Cognito."""

from fastapi import APIRouter, Response

from app import rate_limit
from app.dependencies import ClientIp, DbEngine, Identities, SignedIn
from app.identity import TokenSet
from app.schemas import (
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
    # Every call sends a real email, so throttle per address (stops someone flooding
    # a victim's inbox) and per IP (stops one machine cycling through addresses).
    rate_limit.check(engine, "start:email", email, limit=5, window_seconds=FIFTEEN_MINUTES)
    rate_limit.check(engine, "start:ip", ip, limit=30, window_seconds=FIFTEEN_MINUTES)
    challenge = identities.start_sign_in(email)
    return StartSignInResponse(session=challenge.session)


@router.post("/verify")
def verify(
    body: VerifyCodeRequest, ip: ClientIp, engine: DbEngine, identities: Identities
) -> TokenResponse:
    # Cognito already caps wrong codes per session; this caps sessions per machine.
    rate_limit.check(engine, "verify:ip", ip, limit=30, window_seconds=FIFTEEN_MINUTES)
    return _as_response(identities.verify_code(body.email.lower(), body.code, body.session))


@router.post("/refresh")
def refresh(body: RefreshRequest, identities: Identities) -> TokenResponse:
    return _as_response(identities.refresh(body.refresh_token))


@router.post("/sign-out", status_code=204)
def sign_out(body: SignOutRequest, _: SignedIn, identities: Identities) -> Response:
    identities.sign_out(body.refresh_token)
    return Response(status_code=204)
