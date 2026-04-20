"""Add billing_breakdown_records table

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0007'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'billing_breakdown_records',
        sa.Column('month', sa.String(7), nullable=False),
        sa.Column('env', sa.String, nullable=False),
        sa.Column('resource_set', sa.String, nullable=False),
        sa.Column('product', sa.String, nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.PrimaryKeyConstraint('month', 'env', 'resource_set', 'product'),
    )
    op.create_index(
        'ix_billing_breakdown_month_env',
        'billing_breakdown_records',
        ['month', 'env'],
    )


def downgrade() -> None:
    op.drop_index('ix_billing_breakdown_month_env', table_name='billing_breakdown_records')
    op.drop_table('billing_breakdown_records')
