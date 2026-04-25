"""Drop progress column from projects

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("projects", "progress")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )
