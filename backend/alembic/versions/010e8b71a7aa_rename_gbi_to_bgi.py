"""rename gbi to bgi

Revision ID: 010e8b71a7aa
Revises: 0032
Create Date: 2026-06-11 22:42:07.879221

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010e8b71a7aa'
down_revision: Union[str, None] = '0032'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("projects", "gbi_id", new_column_name="bgi_id")
    op.alter_column("users", "gbi_ids", new_column_name="bgi_ids")
    op.execute(
        "UPDATE users SET role = replace(role, 'gbi_cloud_lead', 'bgi_cloud_lead') "
        "WHERE role LIKE '%gbi_cloud_lead%'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE users SET role = replace(role, 'bgi_cloud_lead', 'gbi_cloud_lead') "
        "WHERE role LIKE '%bgi_cloud_lead%'"
    )
    op.alter_column("users", "bgi_ids", new_column_name="gbi_ids")
    op.alter_column("projects", "bgi_id", new_column_name="gbi_id")
