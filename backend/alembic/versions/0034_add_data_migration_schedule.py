"""add data_migration_schedule to projects

Revision ID: 0034
Revises: 0033
Create Date: 2026-06-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("data_migration_schedule", JSONB, nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column(
            "data_migration_survey_submitted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "data_migration_survey_submitted_at")
    op.drop_column("projects", "data_migration_schedule")
