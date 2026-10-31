from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "own_sign_in"
down_revision: str | Sequence[str] | None = "deleted_learners"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("role", sa.String(10), nullable=False, server_default="student")
    )
    op.create_check_constraint("users_role_known", "users", "role IN ('student', 'admin')")
    op.create_table(
        "credentials",
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("username", sa.String(30), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "recovery_codes",
        sa.Column("code_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.alter_column("guardian_requests", "guardian_email", nullable=True)


def downgrade() -> None:
    op.alter_column("guardian_requests", "guardian_email", nullable=False)
    op.drop_table("refresh_tokens")
    op.drop_table("recovery_codes")
    op.drop_table("credentials")
    op.drop_constraint("users_role_known", "users")
    op.drop_column("users", "role")
