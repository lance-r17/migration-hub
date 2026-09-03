"""add attempts to email_jobs

Revision ID: 0037
Revises: ee32760c66e4
Create Date: 2026-06-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0037"
down_revision: Union[str, None] = "ee32760c66e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_jobs",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("email_jobs", "attempts")
