"""Cascade plan targets when their programme is removed from the reference data."""

from collections.abc import Sequence

from alembic import op

revision: str = "plan_targets_cascade"
down_revision: str | Sequence[str] | None = "nbt_records"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("plan_targets_programme_id_fkey", "plan_targets", type_="foreignkey")
    op.create_foreign_key(
        "plan_targets_programme_id_fkey",
        "plan_targets",
        "programmes",
        ["programme_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("plan_targets_programme_id_fkey", "plan_targets", type_="foreignkey")
    op.create_foreign_key(
        "plan_targets_programme_id_fkey", "plan_targets", "programmes", ["programme_id"], ["id"]
    )
