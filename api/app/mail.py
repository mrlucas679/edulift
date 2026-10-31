"""Outgoing email: SES when a sender is set, the console locally, otherwise off."""

import logging
import sys
from typing import TYPE_CHECKING, Protocol

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.errors import UpstreamUnavailableError

if TYPE_CHECKING:
    from mypy_boto3_sesv2 import SESV2Client

    from app.config import Settings

log = logging.getLogger(__name__)


class Mailer(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...


def mailer_for(settings: "Settings") -> Mailer:
    if settings.sender_email:
        client = boto3.client("sesv2", region_name=settings.aws_region)
        return SesMailer(client, settings.sender_email)
    # On AWS without a sender, refuse rather than print someone's email into the logs.
    return NoMailer() if settings.deployed else ConsoleMailer()


class NoMailer:
    def send(self, to: str, subject: str, body: str) -> None:
        raise UpstreamUnavailableError("Email isn't switched on.")


class SesMailer:
    def __init__(self, client: "SESV2Client", sender: str) -> None:
        self._client = client
        self._sender = sender

    def send(self, to: str, subject: str, body: str) -> None:
        try:
            self._client.send_email(
                FromEmailAddress=self._sender,
                Destination={"ToAddresses": [to]},
                Content={
                    "Simple": {"Subject": {"Data": subject}, "Body": {"Text": {"Data": body}}}
                },
            )
        except (ClientError, BotoCoreError) as exc:
            log.warning("email failed", exc_info=exc)
            raise UpstreamUnavailableError from exc


class ConsoleMailer:
    """Local only. Keeps sent mail so tests can read it."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))
        # Local only, so you can follow links. Printed, never logged.
        print(f"\n--- local email to {to}: {subject}\n{body}\n---", file=sys.stderr)
