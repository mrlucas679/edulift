"""Alembic environment. The database URL comes from DATABASE_URL, or from the
`sqlalchemy.url` attribute a caller (the test suite) sets on the config."""

import os

from alembic import context
from sqlalchemy import create_engine

from app.models import Base

config = context.config
target_metadata = Base.metadata


def _database_url() -> str:
    url = config.attributes.get("database_url") or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Set DATABASE_URL to run migrations")
    return str(url)


def run_migrations_offline() -> None:
    context.configure(url=_database_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_database_url())
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
