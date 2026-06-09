"""migrate user gbi_id to gbi_ids

Revision ID: 0032
Revises: 0031
Create Date: 2026-06-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gbi_ids", JSONB, nullable=False, server_default="[]"))
    op.execute("UPDATE users SET gbi_ids = jsonb_build_array(gbi_id) WHERE gbi_id IS NOT NULL")
    op.drop_column("users", "gbi_id")


def downgrade() -> None:
    op.add_column("users", sa.Column("gbi_id", sa.String(), nullable=True))
    op.execute("UPDATE users SET gbi_id = gbi_ids ->> 0 WHERE jsonb_array_length(gbi_ids) > 0")
    op.drop_column("users", "gbi_ids")
