"""What the API needs from a sign-in service. Cognito in the cloud, a fake locally."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SignInChallenge:
    session: str


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    expires_in: int
    refresh_token: str | None


@dataclass(frozen=True)
class Identity:
    subject: str  # the Cognito sub, which is also users.id


class IdentityProvider(Protocol):
    def start_sign_in(self, email: str) -> SignInChallenge: ...

    def verify_code(self, email: str, code: str, session: str) -> TokenSet: ...

    def refresh(self, refresh_token: str) -> TokenSet: ...

    def sign_out(self, refresh_token: str) -> None: ...

    def verify_access_token(self, token: str) -> Identity: ...
