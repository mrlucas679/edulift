from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Request(BaseModel):
    # Unknown fields are an error, not something to quietly ignore.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StartSignInRequest(Request):
    email: EmailStr = Field(max_length=254)


class StartSignInResponse(BaseModel):
    session: str
    message: str = "If that address can receive email, a code is on its way."


class VerifyCodeRequest(Request):
    email: EmailStr = Field(max_length=254)
    code: str = Field(pattern=r"^\d{6}$")
    session: str = Field(min_length=1, max_length=4096)


class RefreshRequest(Request):
    refresh_token: str = Field(min_length=1, max_length=4096)


class SignOutRequest(Request):
    refresh_token: str = Field(min_length=1, max_length=4096)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None
    expires_in: int
    token_type: Literal["Bearer"] = "Bearer"  # noqa: S105


class MeResponse(BaseModel):
    id: str
    status: Literal["onboarding", "pending_guardian", "active", "restricted"]
    created_at: datetime


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
