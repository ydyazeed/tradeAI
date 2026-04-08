"""per-user symbol tracking and signals

Revision ID: 002
Revises: 001
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Per-user symbol tracking
    op.create_table(
        "user_symbols",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), sa.ForeignKey("tracked_symbols.symbol", ondelete="CASCADE"), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_symbols_user", "user_symbols", ["user_id"])
    op.create_unique_constraint("uq_user_symbols", "user_symbols", ["user_id", "symbol"])

    # Add user_id to signals (nullable so existing rows are unaffected)
    op.add_column("signals", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_signal_user", "signals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_signal_user", "signals")
    op.drop_column("signals", "user_id")
    op.drop_table("user_symbols")
