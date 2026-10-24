"""guardian withdrawal

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guardian_requests", sa.Column("withdraw_token_hash", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "guardian_requests", sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_unique_constraint(
        "uq_guardian_requests_withdraw_token_hash", "guardian_requests", ["withdraw_token_hash"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_guardian_requests_withdraw_token_hash", "guardian_requests", type_="unique"
    )
    op.drop_column("guardian_requests", "withdrawn_at")
    op.drop_column("guardian_requests", "withdraw_token_hash")
