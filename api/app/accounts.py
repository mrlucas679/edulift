from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import User


def get_or_create_account(session: Session, user_id: str) -> User:
    # Two first requests can land at the same moment, so insert-or-ignore, then read.
    session.execute(insert(User).values(id=user_id).on_conflict_do_nothing(index_elements=["id"]))
    return session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    ).scalar_one()
