"""Tombstones for deleted learners, so a deleted account cannot be recreated by an old token."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "deleted_learners"
down_revision: str | Sequence[str] | None = "plan_targets_cascade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deleted_learners",
        sa.Column("user_id", sa.String(length=64), primary_key=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("deleted_learners")
