"""make_resource_id_pk_drop_id

Revision ID: c9e27d4f542c
Revises: 0015
Create Date: 2026-04-25 23:49:04.744434

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e27d4f542c'
down_revision: Union[str, None] = '0015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill any missing resource_id values before making it non-nullable
    op.execute("UPDATE cloud_resources SET resource_id = 'auto-' || id WHERE resource_id IS NULL")

    # Drop old primary key constraint on id
    op.drop_constraint('cloud_resources_pkey', 'cloud_resources', type_='primary')

    # Drop the id column
    op.drop_column('cloud_resources', 'id')

    # Ensure resource_id is NOT NULL
    op.alter_column('cloud_resources', 'resource_id', nullable=False)

    # Create new primary key on resource_id
    op.create_primary_key('cloud_resources_pkey', 'cloud_resources', ['resource_id'])


def downgrade() -> None:
    # Drop new primary key on resource_id
    op.drop_constraint('cloud_resources_pkey', 'cloud_resources', type_='primary')

    # Re-add the id column
    op.add_column('cloud_resources', sa.Column('id', sa.String(), nullable=False))

    # Recreate old primary key on id
    op.create_primary_key('cloud_resources_pkey', 'cloud_resources', ['id'])

    # Allow resource_id to be nullable again
    op.alter_column('cloud_resources', 'resource_id', nullable=True)
