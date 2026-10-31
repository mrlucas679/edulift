from typing import Literal, Self
from urllib.parse import quote

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """From env vars. Secrets have no defaults."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    edulift_env: Literal["local", "test", "demo"]
    # Signs access tokens. 32+ random characters, from Secrets Manager on AWS.
    auth_secret: str

    # DATABASE_URL locally; separate parts on AWS (password from the RDS secret).
    database_url: str = ""
    db_host: str = ""
    db_port: int = 5432
    db_name: str = ""
    db_user: str = ""
    db_password: str = ""

    aws_region: str = ""
    cors_origins: str = ""
    # Proxies in front of us: 2 on AWS (CloudFront + load balancer), 0 locally.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)
    # Sent by CloudFront. Requests without it skipped CloudFront.
    origin_secret: str = ""
    # Where guardian links point, e.g. https://xyz.cloudfront.net
    app_url: str = ""
    # Email is off unless a verified SES sender is set.
    sender_email: str = ""
    # Set to turn on the one-tap demo. Empty keeps it off.
    demo_secret: str = ""
    ai_enabled: bool = False
    bedrock_model_id: str = ""
    # Used only when the first model is busy or unavailable. Off on AWS (see docs/ai.md).
    bedrock_fallback_model_id: str = ""
    ai_timeout_seconds: float = 8

    @model_validator(mode="after")
    def _check(self) -> Self:
        if len(self.auth_secret) < 32:  # noqa: PLR2004
            raise ValueError("AUTH_SECRET must be 32+ characters")
        if self.edulift_env == "demo":
            if self.app_url and not self.app_url.startswith("https://"):
                raise ValueError("APP_URL must be https in demo")
            if len(self.origin_secret) < 32:  # noqa: PLR2004
                raise ValueError("demo needs ORIGIN_SECRET (32+ characters)")
        if self.demo_secret and len(self.demo_secret) < 32:  # noqa: PLR2004
            raise ValueError("DEMO_SECRET must be 32+ characters")
        if not self.database_url and not (self.db_host and self.db_name and self.db_user):
            raise ValueError("set DATABASE_URL, or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD")
        return self

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        password = quote(self.db_password, safe="")
        return (
            f"postgresql+psycopg://{quote(self.db_user, safe='')}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?sslmode=require"
        )

    @property
    def deployed(self) -> bool:
        return self.edulift_env == "demo"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
