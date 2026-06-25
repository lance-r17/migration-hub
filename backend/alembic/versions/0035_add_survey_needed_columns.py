"""add survey needed columns to projects

Revision ID: 0035
Revises: 3c8fc8ffad25
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0035"
down_revision: Union[str, None] = "3c8fc8ffad25"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("is_survey_needed", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "projects",
        sa.Column("justification_without_survey", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "justification_without_survey")
    op.drop_column("projects", "is_survey_needed")
