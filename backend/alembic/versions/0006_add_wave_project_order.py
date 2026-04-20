"""Add project_order JSONB to waves

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('waves', sa.Column('project_order', postgresql.JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('waves', 'project_order')
