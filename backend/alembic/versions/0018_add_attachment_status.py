"""add attachment status

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-24 08:20:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_attachments",
        sa.Column("status", sa.String(), server_default="pending", nullable=False),
    )
    op.add_column(
        "project_attachments",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill existing rows to 'confirmed' since they were already in use
    op.execute("UPDATE project_attachments SET status = 'confirmed'")


def downgrade() -> None:
    op.drop_column("project_attachments", "updated_at")
    op.drop_column("project_attachments", "status")
