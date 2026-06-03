"""Add category_milestones table and project_category_milestone association

Revision ID: 0030
Revises: 0029
Create Date: 2026-06-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create category_milestones table
    op.create_table(
        "category_milestones",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_date", sa.String(), nullable=False),
        sa.Column("end_date", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create association table
    op.create_table(
        "project_category_milestone",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("category_milestone_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_milestone_id"], ["category_milestones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "category_milestone_id"),
    )


def downgrade() -> None:
    op.drop_table("project_category_milestone")
    op.drop_table("category_milestones")
