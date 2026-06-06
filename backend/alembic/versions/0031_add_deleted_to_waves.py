"""Add deleted column to waves table

Revision ID: 0031
Revises: 0030
Create Date: 2026-06-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("waves", sa.Column("deleted", sa.Boolean(), nullable=True, server_default=sa.text("false")))
    op.execute("UPDATE waves SET deleted = FALSE WHERE deleted IS NULL")
    op.alter_column("waves", "deleted", existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    op.alter_column("waves", "deleted", existing_type=sa.Boolean(), nullable=True)
    op.drop_column("waves", "deleted")
