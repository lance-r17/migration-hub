"""add data_migration_survey_submitted_by

Revision ID: 3c8fc8ffad25
Revises: 0034
Create Date: 2026-06-17 06:17:41.153001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3c8fc8ffad25'
down_revision: Union[str, None] = '0034'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'projects',
        sa.Column('data_migration_survey_submitted_by', sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('projects', 'data_migration_survey_submitted_by')
