"""drop jira_base_url and jira_ticket from projects

Revision ID: 4d1578fe989f
Revises: 0020
Create Date: 2026-04-29 21:26:52.321129

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d1578fe989f'
down_revision: Union[str, None] = '0020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('projects', 'jira_base_url')
    op.drop_column('projects', 'jira_ticket')


def downgrade() -> None:
    op.add_column('projects', sa.Column('jira_base_url', sa.String(), nullable=True))
    op.add_column('projects', sa.Column('jira_ticket', sa.String(), nullable=True))
