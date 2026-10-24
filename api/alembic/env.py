"""Alembic env. URL from app settings, or from the test suite."""

from alembic import context
from sqlalchemy import create_engine, text

from app.config import Settings
from app.models import Base

config = context.config
target_metadata = Base.metadata

# Any number nothing else uses.
MIGRATION_LOCK = 724_001


def _url() -> str:
    return str(config.attributes.get("database_url") or Settings().migration_sqlalchemy_url)


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url())
    with engine.connect() as connection:
        # Tasks migrate on start; the lock makes them take turns.
        connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": MIGRATION_LOCK})
        try:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": MIGRATION_LOCK})
            connection.commit()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
