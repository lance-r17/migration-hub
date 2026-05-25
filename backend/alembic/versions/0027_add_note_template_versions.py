"""Add note_template_versions table

Revision ID: 0027
Revises: 0026
Create Date: 2026-05-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "note_template_versions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("template_id", sa.String(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("labels", JSONB, nullable=False, server_default="[]"),
        sa.Column("blocks", JSONB, nullable=False, server_default="[]"),
        sa.Column("scope", sa.String(), nullable=False),
        sa.Column("shared_roles", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["note_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_note_template_versions_template_id",
        "note_template_versions",
        ["template_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_note_template_versions_template_id")
    op.drop_table("note_template_versions")
