"""contact email for reminders

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("contact_email", sa.String(length=254), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "contact_email")
