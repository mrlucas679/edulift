"""users and rate_limit_hits

Revision ID: 0001
Revises:
Create Date: 2026-10-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="onboarding"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('onboarding', 'pending_guardian', 'active', 'restricted')",
            name="users_status_known",
        ),
    )
    op.create_table(
        "rate_limit_hits",
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hits", sa.Integer, nullable=False),
        sa.PrimaryKeyConstraint("key", "window_start"),
    )


def downgrade() -> None:
    op.drop_table("rate_limit_hits")
    op.drop_table("users")
