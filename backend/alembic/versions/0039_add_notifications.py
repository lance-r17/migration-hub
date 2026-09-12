"""Add notifications table

Revision ID: 0039
Revises: 0038
Create Date: 2026-07-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
