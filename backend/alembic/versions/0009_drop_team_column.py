"""Drop projects.team column (replaced by project_users JOIN users)

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("projects", "team")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("team", JSONB, nullable=False, server_default="[]"),
    )
