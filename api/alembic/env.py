"""Alembic environment.

The URL comes from the same settings the API uses, or from `database_url` on the config
when the test suite runs migrations itself.
"""

from alembic import context
from sqlalchemy import create_engine, text

from app.config import Settings
from app.models import Base

config = context.config
target_metadata = Base.metadata

# Any fixed number works, as long as nothing else in the database uses it.
MIGRATION_LOCK = 724_001


def _url() -> str:
    return str(config.attributes.get("database_url") or Settings().sqlalchemy_url)


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url())
    with engine.connect() as connection:
        # Every API task runs migrations when it starts. The lock makes the second task
        # wait for the first instead of both trying to create the same tables.
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
