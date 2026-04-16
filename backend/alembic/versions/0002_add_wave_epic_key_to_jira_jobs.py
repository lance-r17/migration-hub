"""Add wave_epic_key to jira_jobs

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jira_jobs", sa.Column("wave_epic_key", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("jira_jobs", "wave_epic_key")
