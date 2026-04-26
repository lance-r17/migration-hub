"""Add blocked_reason to projects

Revision ID: 0019
Revises: 0018
Create Date: 2026-04-26 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("blocked_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "blocked_reason")
