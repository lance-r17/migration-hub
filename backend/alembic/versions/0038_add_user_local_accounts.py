"""Add user_local_accounts table

Revision ID: 0038
Revises: 0037
Create Date: 2026-07-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_local_accounts",
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("account_name", sa.String(), nullable=False),
        sa.Column("password", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("account_name"),
    )


def downgrade() -> None:
    op.drop_table("user_local_accounts")
