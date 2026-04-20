"""Add planned_start_date and planned_end_date to projects

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("planned_start_date", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("planned_end_date", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "planned_end_date")
    op.drop_column("projects", "planned_start_date")
