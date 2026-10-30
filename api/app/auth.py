"""Who is calling: set only from a verified token."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Identity:
    subject: str  # users.id
