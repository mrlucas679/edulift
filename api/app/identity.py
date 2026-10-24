import logging

import boto3

from app.auth import Auth
from app.cognito import CognitoAuth
from app.config import Settings
from app.fake_auth import FakeAuth

log = logging.getLogger(__name__)


def identity_for(settings: Settings) -> Auth:
    if settings.identity_provider == "cognito":
        return CognitoAuth(
            boto3.client("cognito-idp", region_name=settings.aws_region),
            user_pool_id=settings.cognito_user_pool_id,
            app_client_id=settings.cognito_app_client_id,
            region=settings.aws_region,
        )

    def print_code(_email: str, code: str) -> None:
        log.warning("local sign-in code: %s", code)

    return FakeAuth(send_code=print_code)
