"""Sign in through Cognito email codes and demo email/password accounts."""

import logging
from typing import TYPE_CHECKING, Any

import jwt
from botocore.exceptions import BotoCoreError, ClientError

from app.auth import Challenge, Identity, TokenSet
from app.errors import (
    AccountExistsError,
    CodeExpiredError,
    InvalidCodeError,
    InvalidCredentialsError,
    UnauthenticatedError,
    UpstreamUnavailableError,
)

if TYPE_CHECKING:
    from mypy_boto3_cognito_idp import CognitoIdentityProviderClient

logger = logging.getLogger(__name__)

# Expired session or too many wrong codes: ask for a new code.
_WRONG_CODE = {"CodeMismatchException"}
_START_AGAIN = {"ExpiredCodeException", "NotAuthorizedException", "TooManyFailedAttemptsException"}


def _aws_error(exc: ClientError) -> str:
    return str(exc.response.get("Error", {}).get("Code", ""))


class CognitoAuth:
    def __init__(
        self,
        client: "CognitoIdentityProviderClient",
        user_pool_id: str,
        app_client_id: str,
        region: str,
    ) -> None:
        self._client = client
        self._pool_id = user_pool_id
        self._client_id = app_client_id
        self._issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
        self._jwks = jwt.PyJWKClient(f"{self._issuer}/.well-known/jwks.json")

    def create_demo_account(self, email: str, password: str) -> TokenSet:
        try:
            self._client.admin_create_user(
                UserPoolId=self._pool_id,
                Username=email,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                ],
                MessageAction="SUPPRESS",
            )
            self._client.admin_set_user_password(
                UserPoolId=self._pool_id, Username=email, Password=password, Permanent=True
            )
        except ClientError as exc:
            if _aws_error(exc) in {"UsernameExistsException", "AliasExistsException"}:
                raise AccountExistsError from exc
            logger.warning("cognito could not create a demo account", exc_info=exc)
            raise UpstreamUnavailableError from exc
        except BotoCoreError as exc:
            logger.warning("cognito could not create a demo account", exc_info=exc)
            raise UpstreamUnavailableError from exc
        return self.sign_in_demo(email, password)

    def sign_in_demo(self, email: str, password: str) -> TokenSet:
        try:
            response = self._client.initiate_auth(
                AuthFlow="USER_AUTH",
                ClientId=self._client_id,
                AuthParameters={
                    "USERNAME": email,
                    "PREFERRED_CHALLENGE": "PASSWORD",
                    "PASSWORD": password,
                },
            )
        except ClientError as exc:
            if _aws_error(exc) in {"NotAuthorizedException", "UserNotFoundException"}:
                raise InvalidCredentialsError from exc
            logger.warning("cognito failed during demo sign-in", exc_info=exc)
            raise UpstreamUnavailableError from exc
        except BotoCoreError as exc:
            logger.warning("cognito failed during demo sign-in", exc_info=exc)
            raise UpstreamUnavailableError from exc
        return _tokens(response.get("AuthenticationResult"), InvalidCredentialsError)

    def send_code(self, email: str) -> Challenge:
        try:
            self._ensure_user(email)
            response = self._client.initiate_auth(
                AuthFlow="USER_AUTH",
                ClientId=self._client_id,
                AuthParameters={"USERNAME": email, "PREFERRED_CHALLENGE": "EMAIL_OTP"},
            )
        except (ClientError, BotoCoreError) as exc:
            logger.warning("cognito refused to start sign-in", exc_info=exc)
            raise UpstreamUnavailableError from exc

        session = response.get("Session")
        if response.get("ChallengeName") != "EMAIL_OTP" or not session:
            # Email codes switched off in the pool.
            logger.error("cognito did not offer an email code")
            raise UpstreamUnavailableError
        return Challenge(session=session)

    def check_code(self, email: str, code: str, session: str) -> TokenSet:
        try:
            response = self._client.respond_to_auth_challenge(
                ClientId=self._client_id,
                ChallengeName="EMAIL_OTP",
                Session=session,
                ChallengeResponses={"USERNAME": email, "EMAIL_OTP_CODE": code},
            )
        except ClientError as exc:
            if _aws_error(exc) in _WRONG_CODE:
                raise InvalidCodeError from exc
            if _aws_error(exc) in _START_AGAIN:
                raise CodeExpiredError from exc
            logger.warning("cognito failed while checking a code", exc_info=exc)
            raise UpstreamUnavailableError from exc
        except BotoCoreError as exc:
            raise UpstreamUnavailableError from exc
        return _tokens(response.get("AuthenticationResult"), CodeExpiredError)

    def refresh(self, refresh_token: str) -> TokenSet:
        try:
            response = self._client.initiate_auth(
                AuthFlow="REFRESH_TOKEN_AUTH",
                ClientId=self._client_id,
                AuthParameters={"REFRESH_TOKEN": refresh_token},
            )
        except ClientError as exc:
            if _aws_error(exc) == "NotAuthorizedException":
                raise UnauthenticatedError from exc
            raise UpstreamUnavailableError from exc
        except BotoCoreError as exc:
            raise UpstreamUnavailableError from exc
        return _tokens(response.get("AuthenticationResult"), UnauthenticatedError)

    def sign_out(self, refresh_token: str) -> None:
        try:
            self._client.revoke_token(Token=refresh_token, ClientId=self._client_id)
        except ClientError as exc:
            if _aws_error(exc) in {"UnsupportedTokenTypeException", "InvalidParameterException"}:
                raise UnauthenticatedError from exc
            raise UpstreamUnavailableError from exc
        except BotoCoreError as exc:
            raise UpstreamUnavailableError from exc

    def check_token(self, token: str) -> Identity:
        # Pin the algorithm; reject ID tokens and other clients' tokens.
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims: dict[str, Any] = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self._issuer,
                options={"require": ["exp", "iss", "sub", "token_use", "client_id"]},
            )
        except jwt.PyJWTError as exc:
            raise UnauthenticatedError from exc
        if claims["token_use"] != "access" or claims["client_id"] != self._client_id:  # noqa: S105
            raise UnauthenticatedError
        return Identity(subject=str(claims["sub"]))

    def email_of(self, subject: str) -> str:
        try:
            user = self._client.admin_get_user(UserPoolId=self._pool_id, Username=subject)
        except (ClientError, BotoCoreError) as exc:
            raise UpstreamUnavailableError from exc
        attrs = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
        return attrs["email"]

    def delete_user(self, subject: str) -> None:
        try:
            self._client.admin_delete_user(UserPoolId=self._pool_id, Username=subject)
        except ClientError as exc:
            if _aws_error(exc) != "UserNotFoundException":
                raise UpstreamUnavailableError from exc
        except BotoCoreError as exc:
            raise UpstreamUnavailableError from exc

    def _ensure_user(self, email: str) -> None:
        # Safe to mark verified: tokens still need the emailed code.
        try:
            self._client.admin_get_user(UserPoolId=self._pool_id, Username=email)
        except ClientError as exc:
            if _aws_error(exc) != "UserNotFoundException":
                raise
            self._client.admin_create_user(
                UserPoolId=self._pool_id,
                Username=email,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                ],
                MessageAction="SUPPRESS",
            )


def _tokens(result: Any, error: type[Exception]) -> TokenSet:
    if not result or "AccessToken" not in result:
        raise error
    return TokenSet(
        access_token=result["AccessToken"],
        expires_in=int(result.get("ExpiresIn", 3600)),
        refresh_token=result.get("RefreshToken"),
    )
