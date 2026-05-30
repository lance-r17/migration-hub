"""add gbi_id to users and projects

Revision ID: f2e5eb7f4e02
Revises: 0028
Create Date: 2026-05-29 18:33:11.596800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2e5eb7f4e02'
down_revision: Union[str, None] = '0028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('gbi_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('gbi_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'gbi_id')
    op.drop_column('projects', 'gbi_id')
