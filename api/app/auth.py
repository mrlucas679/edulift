"""Sign-in interface. Cognito in the cloud, a fake locally."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Challenge:
    session: str


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    expires_in: int
    refresh_token: str | None


@dataclass(frozen=True)
class Identity:
    subject: str  # the Cognito sub, which is also users.id


class Auth(Protocol):
    def send_code(self, email: str) -> Challenge: ...

    def check_code(self, email: str, code: str, session: str) -> TokenSet: ...

    def refresh(self, refresh_token: str) -> TokenSet: ...

    def sign_out(self, refresh_token: str) -> None: ...

    def check_token(self, token: str) -> Identity: ...
