"""add data_migration_plan to projects

Revision ID: 0036
Revises: 0035
Create Date: 2026-06-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("data_migration_plan", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "data_migration_plan")
