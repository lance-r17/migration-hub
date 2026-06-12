"""add engagement_reviewer_ids to engagements

Revision ID: 0033
Revises: 0032
Create Date: 2026-06-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0033"
down_revision: Union[str, None] = "010e8b71a7aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "engagements",
        sa.Column("engagement_reviewer_ids", JSONB, nullable=True, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("engagements", "engagement_reviewer_ids")
