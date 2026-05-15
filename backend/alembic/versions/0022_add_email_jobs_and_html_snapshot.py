"""Add email_jobs table and html_snapshot to email_templates

Revision ID: 0022
Revises: 0021
Create Date: 2025-01-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add html_snapshot to email_templates
    op.add_column(
        "email_templates",
        sa.Column("html_snapshot", sa.String(), nullable=True),
    )

    # Create email_jobs table
    op.create_table(
        "email_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("template_id", sa.String(), nullable=False),
        sa.Column("to_addrs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("html_body", sa.String(), nullable=False),
        sa.Column(
            "context",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("idempotency_key", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["email_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_jobs_status", "email_jobs", ["status"])
    op.create_index("ix_email_jobs_event_type", "email_jobs", ["event_type"])
    op.create_index("ix_email_jobs_idempotency_key", "email_jobs", ["idempotency_key"])


def downgrade() -> None:
    op.drop_table("email_jobs")
    op.drop_column("email_templates", "html_snapshot")
