"""nbt records

Revision ID: nbt_records
Revises: fps_bands

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "nbt_records"
down_revision: str | Sequence[str] | None = "fps_bands"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "nbt_records",
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("component", sa.String(length=3), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column(
            "entered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("component IN ('AL', 'QL', 'MAT')", name="nbt_component"),
        sa.CheckConstraint(
            "level IN ('basic', 'intermediate', 'upper_intermediate', 'proficient')",
            name="nbt_level",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "component"),
    )


def downgrade() -> None:
    op.drop_table("nbt_records")
