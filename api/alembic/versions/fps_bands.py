"""fps bands

Revision ID: fps_bands
Revises: profile_interests

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "fps_bands"
down_revision: str | Sequence[str] | None = "profile_interests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("programmes", sa.Column("aps_scheme", sa.String(length=30), nullable=True))
    op.add_column(
        "programmes",
        sa.Column("nbt", postgresql.JSONB(), nullable=False, server_default="[]"),
    )
    op.add_column("programmes", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("programmes", sa.Column("floor", postgresql.JSONB(), nullable=True))
    op.create_table(
        "fps_bands",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("programme_id", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=False),
        sa.Column("metric", sa.String(length=7), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("applies_to", sa.String(length=20), nullable=False),
        sa.Column("requirements", postgresql.JSONB(), nullable=False),
        sa.Column("nbt", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.ForeignKeyConstraint(["programme_id"], ["programmes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("fps_bands")
    op.drop_column("programmes", "floor")
    op.drop_column("programmes", "notes")
    op.drop_column("programmes", "nbt")
    op.drop_column("programmes", "aps_scheme")
