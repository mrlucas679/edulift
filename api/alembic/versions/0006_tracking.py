"""saved items, applications and reminders

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("target_kind", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "target_kind", "target_id"),
    )
    op.create_index("ix_saved_items_user_id", "saved_items", ["user_id"])
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("target_kind", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="planning", nullable=False),
        sa.Column("external_reference", sa.String(length=60), nullable=True),
        sa.Column("submitted_on", sa.Date(), nullable=True),
        sa.Column("offer_deadline", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_table(
        "checklist_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("done", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_checklist_items_application_id", "checklist_items", ["application_id"])
    op.create_table(
        "reminders_sent",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("target_kind", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.String(length=80), nullable=False),
        sa.Column("threshold_days", sa.Integer(), nullable=False),
        sa.Column(
            "sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "target_kind", "target_id", "threshold_days"),
    )
    op.create_index("ix_reminders_sent_user_id", "reminders_sent", ["user_id"])


def downgrade() -> None:
    op.drop_table("reminders_sent")
    op.drop_table("checklist_items")
    op.drop_table("applications")
    op.drop_table("saved_items")
