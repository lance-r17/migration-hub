"""Replace planned_start_date/planned_end_date with planning JSONB; add color to waves

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add planning JSONB column
    op.add_column("projects", sa.Column("planning", postgresql.JSONB(), nullable=True))

    # 2. Migrate existing planned date data into planning JSON
    op.execute("""
        UPDATE projects
        SET planning = jsonb_build_object(
            'startDate', planned_start_date,
            'endDate',   planned_end_date,
            'tasks',     '[]'::jsonb
        )
        WHERE planned_start_date IS NOT NULL
           OR planned_end_date   IS NOT NULL
    """)

    # 3. Drop old date columns
    op.drop_column("projects", "planned_start_date")
    op.drop_column("projects", "planned_end_date")

    # 4. Add color column to waves
    op.add_column("waves", sa.Column("color", sa.String(), nullable=True))


def downgrade() -> None:
    # Reverse: re-add the two date columns, copy data back, drop planning + color
    op.drop_column("waves", "color")

    op.add_column("projects", sa.Column("planned_start_date", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("planned_end_date", sa.String(), nullable=True))

    op.execute("""
        UPDATE projects
        SET planned_start_date = planning->>'startDate',
            planned_end_date   = planning->>'endDate'
        WHERE planning IS NOT NULL
    """)

    op.drop_column("projects", "planning")
