"""Give or take away admin. The only way to make an admin: run this with AWS access.

python -m app.jobs.admins grant <username>
python -m app.jobs.admins revoke <username>
"""

import logging
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app import tokens
from app.config import Settings
from app.db import new_engine

log = logging.getLogger(__name__)


def set_role(db: Session, username: str, role: str) -> bool:
    user_id = db.scalar(
        select(m.Credential.user_id).where(m.Credential.username == username.lower())
    )
    if user_id is None:
        return False
    db.get_one(m.User, user_id).role = role
    # A change of privilege ends every sign-in (OWASP session management).
    tokens.sign_out_everywhere(db, user_id)
    return True


def main() -> None:
    actions = {"grant": "admin", "revoke": "student"}
    if len(sys.argv) != 3 or sys.argv[1] not in actions:  # noqa: PLR2004
        sys.exit(__doc__)
    settings = Settings()
    with Session(new_engine(settings.sqlalchemy_url)) as db, db.begin():
        found = set_role(db, sys.argv[2], actions[sys.argv[1]])
    if not found:
        sys.exit("No account has that username.")
    log.info("admins: %s done", sys.argv[1])


if __name__ == "__main__":
    main()
