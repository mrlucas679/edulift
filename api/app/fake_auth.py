"""Local stand-in for Cognito, including demo-account credentials."""

import hashlib
import hmac
import secrets
import threading
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import jwt

from app.auth import Challenge, Identity, TokenSet
from app.errors import (
    AccountExistsError,
    CodeExpiredError,
    InvalidCodeError,
    InvalidCredentialsError,
    UnauthenticatedError,
)

ISSUER = "edulift-local"
TOKEN_SECONDS = 3600
MAX_TRIES = 3


class FakeAuth:
    def __init__(self, send_code: Callable[[str, str], None]) -> None:
        self._send_code = send_code
        self._key = secrets.token_bytes(32)
        self._lock = threading.Lock()
        self._codes: dict[str, tuple[str, str]] = {}  # session -> (email, code)
        self._tries: dict[str, int] = {}
        self._users: dict[str, str] = {}  # email -> subject
        self._refresh_tokens: dict[str, str] = {}  # token -> subject
        self._demo_passwords: dict[str, tuple[str, bytes, bytes]] = {}

    def create_demo_account(self, email: str, password: str) -> TokenSet:
        with self._lock:
            if email in self._demo_passwords or email in self._users:
                raise AccountExistsError
            subject = str(uuid.uuid4())
            salt = secrets.token_bytes(16)
            password_hash = _password_hash(password, salt)
            self._demo_passwords[email] = (subject, salt, password_hash)
        return self._demo_tokens(subject)

    def sign_in_demo(self, email: str, password: str) -> TokenSet:
        with self._lock:
            account = self._demo_passwords.get(email)
            if account is None or not hmac.compare_digest(
                account[2], _password_hash(password, account[1])
            ):
                raise InvalidCredentialsError
        return self._demo_tokens(account[0])

    def _demo_tokens(self, subject: str) -> TokenSet:
        with self._lock:
            refresh_token = secrets.token_urlsafe(32)
            self._refresh_tokens[refresh_token] = subject
        return TokenSet(self._access_token(subject), TOKEN_SECONDS, refresh_token)

    def send_code(self, email: str) -> Challenge:
        session = secrets.token_urlsafe(32)
        code = f"{secrets.randbelow(1_000_000):06d}"
        with self._lock:
            self._codes[session] = (email, code)
            self._users.setdefault(email, str(uuid.uuid4()))
        self._send_code(email, code)
        return Challenge(session=session)

    def check_code(self, email: str, code: str, session: str) -> TokenSet:
        with self._lock:
            expected = self._codes.get(session)
            if expected is None or expected[0] != email:
                raise CodeExpiredError
            if not secrets.compare_digest(expected[1], code):
                self._tries[session] = self._tries.get(session, 0) + 1
                if self._tries[session] >= MAX_TRIES:
                    del self._codes[session]
                    raise CodeExpiredError
                raise InvalidCodeError
            del self._codes[session]
            subject = self._users[email]
            refresh_token = secrets.token_urlsafe(32)
            self._refresh_tokens[refresh_token] = subject
        return TokenSet(self._access_token(subject), TOKEN_SECONDS, refresh_token)

    def refresh(self, refresh_token: str) -> TokenSet:
        with self._lock:
            subject = self._refresh_tokens.get(refresh_token)
        if subject is None:
            raise UnauthenticatedError
        return TokenSet(self._access_token(subject), TOKEN_SECONDS, None)

    def sign_out(self, refresh_token: str) -> None:
        with self._lock:
            if self._refresh_tokens.pop(refresh_token, None) is None:
                raise UnauthenticatedError

    def check_token(self, token: str) -> Identity:
        try:
            claims = jwt.decode(
                token,
                self._key,
                algorithms=["HS256"],
                issuer=ISSUER,
                options={"require": ["exp", "iss", "sub", "token_use"]},
            )
        except jwt.PyJWTError as exc:
            raise UnauthenticatedError from exc
        if claims["token_use"] != "access":  # noqa: S105
            raise UnauthenticatedError
        return Identity(subject=str(claims["sub"]))

    def email_of(self, subject: str) -> str:
        with self._lock:
            for email, current in self._users.items():
                if current == subject:
                    return email
            for email, (current, _, _) in self._demo_passwords.items():
                if current == subject:
                    return email
        raise UnauthenticatedError

    def delete_user(self, subject: str) -> None:
        with self._lock:
            self._users = {e: s for e, s in self._users.items() if s != subject}
            self._demo_passwords = {
                email: account
                for email, account in self._demo_passwords.items()
                if account[0] != subject
            }

    def expired_token(self, subject: str) -> str:
        # For tests.
        return self._access_token(subject, lifetime=timedelta(seconds=-1))

    def _access_token(self, subject: str, lifetime: timedelta | None = None) -> str:
        expires = datetime.now(UTC) + (lifetime or timedelta(seconds=TOKEN_SECONDS))
        claims = {"sub": subject, "iss": ISSUER, "token_use": "access", "exp": expires}
        return jwt.encode(claims, self._key, algorithm="HS256")


def _password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
