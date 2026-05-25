"""Add shared_roles to note_templates

Revision ID: 0026
Revises: 0025
Create Date: 2026-05-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "note_templates",
        sa.Column("shared_roles", JSONB, nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("note_templates", "shared_roles")
