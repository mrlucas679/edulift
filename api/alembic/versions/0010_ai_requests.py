"""ai requests

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id_hash", sa.String(length=64), nullable=False),
        sa.Column("feature", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.String(length=80), nullable=False),
        sa.Column("outcome_class", sa.String(length=30), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("fallback_reason", sa.String(length=30), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_requests_user_id_hash", "ai_requests", ["user_id_hash"])


def downgrade() -> None:
    op.drop_table("ai_requests")
