from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import User


def ensure_account(session: Session, user_id: str) -> User:
    # Insert-or-ignore: two first requests can race.
    session.execute(insert(User).values(id=user_id).on_conflict_do_nothing(index_elements=["id"]))
    return session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    ).scalar_one()
