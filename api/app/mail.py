"""Outgoing email. SES on AWS, the console locally."""

import logging
import sys
from typing import TYPE_CHECKING, Protocol

from botocore.exceptions import BotoCoreError, ClientError

from app.errors import UpstreamUnavailableError

if TYPE_CHECKING:
    from mypy_boto3_sesv2 import SESV2Client

log = logging.getLogger(__name__)


class Mailer(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...


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
