from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker


def new_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def transaction(factory: sessionmaker[Session]) -> Iterator[Session]:
    # One transaction per request.
    with factory() as session, session.begin():
        yield session


def db_ok(engine: Engine) -> bool:
    try:
        with engine.connect() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return False
    return True
