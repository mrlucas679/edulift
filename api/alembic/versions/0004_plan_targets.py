"""plan targets

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plan_targets",
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("programme_id", sa.String(length=80), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["programme_id"], ["programmes.id"]),
        sa.PrimaryKeyConstraint("user_id", "programme_id"),
    )


def downgrade() -> None:
    op.drop_table("plan_targets")
