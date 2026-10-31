"""Passwords and recovery codes.

Passwords: Argon2id at OWASP's minimum (19 MiB, 2 passes, 1 lane), which fits our small
API tasks. Length is the rule, not character classes, and well-known or leaked passwords
are refused using zxcvbn's built-in lists, so nothing leaves the server.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from zxcvbn import zxcvbn  # type: ignore[import-untyped]

MIN_LENGTH = 15
MAX_LENGTH = 128
# zxcvbn scores 0-4; below 3 is guessable with a leaked-password list.
MIN_SCORE = 3
CODE_COUNT = 10
# No 0/O or 1/I/L, so a code copied by hand is still right.
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_GROUPS = 3
CODE_GROUP_LENGTH = 4

_hasher = PasswordHasher(time_cost=2, memory_cost=19_456, parallelism=1)
# Checked against when the username is unknown, so a miss takes as long as a hit.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def weak_reason(password: str, username: str) -> str | None:
    """Why a new password isn't allowed, in words a learner can act on, or None."""
    if len(password) < MIN_LENGTH:
        return f"Use at least {MIN_LENGTH} characters. A few unrelated words work well."
    if len(password) > MAX_LENGTH:
        return f"Use at most {MAX_LENGTH} characters."
    if username.lower() in password.lower():
        return "Don't use your username in your password."
    if zxcvbn(password, user_inputs=[username])["score"] < MIN_SCORE:
        return "That password is easy to guess. Try a few unrelated words."
    return None


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def check_password(stored_hash: str | None, password: str) -> tuple[bool, str | None]:
    """Whether the password matches, and a new hash if the stored one is out of date."""
    try:
        _hasher.verify(stored_hash or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        return False, None
    if stored_hash is None:
        return False, None
    return True, hash_password(password) if _hasher.check_needs_rehash(stored_hash) else None


def new_recovery_codes() -> list[str]:
    """Ten codes like 7KQM-X2RB-9FTD: about 59 bits each."""
    return [
        "-".join(
            "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_GROUP_LENGTH))
            for _ in range(CODE_GROUPS)
        )
        for _ in range(CODE_COUNT)
    ]


def code_hash(code: str) -> str:
    # Random, high-entropy codes: a plain hash is enough, unlike passwords.
    normal = code.upper().replace("-", "").replace(" ", "")
    return hashlib.sha256(normal.encode()).hexdigest()
