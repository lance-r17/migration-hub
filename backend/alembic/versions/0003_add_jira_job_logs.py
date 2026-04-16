"""Add jira_job_logs table

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "jira_job_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("meta", JSONB, nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["jira_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jira_job_logs_job_id", "jira_job_logs", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_jira_job_logs_job_id", table_name="jira_job_logs")
    op.drop_table("jira_job_logs")
