from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Everything comes from environment variables. Secrets have no defaults."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    edulift_env: Literal["local", "test", "demo"]
    database_url: str
    identity_provider: Literal["cognito", "fake"]
    aws_region: str = ""
    cognito_user_pool_id: str = ""
    cognito_app_client_id: str = ""
    cors_origins: str = ""
    # How many proxies sit in front of us and append to X-Forwarded-For
    # (CloudFront + the load balancer = 2). 0 locally: use the socket address.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.edulift_env == "demo" and self.identity_provider == "fake":
            raise ValueError("the fake sign-in provider must never run in demo")
        if self.identity_provider == "cognito" and not (
            self.aws_region and self.cognito_user_pool_id and self.cognito_app_client_id
        ):
            raise ValueError(
                "cognito needs AWS_REGION, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID"
            )
        return self

    @property
    def deployed(self) -> bool:
        return self.edulift_env == "demo"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
