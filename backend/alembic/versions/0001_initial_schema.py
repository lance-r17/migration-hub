"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-04-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("department", sa.String(), nullable=False),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("initials", sa.String(10), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
    )

    # 2. waves
    op.create_table(
        "waves",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_date", sa.String(), nullable=False),
        sa.Column("cutover_date", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("jira_project_key", sa.String(), nullable=False),
        sa.Column("jira_epic_key", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default="created"),
        sa.Column("status", sa.String(), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 3. projects (FK → waves)
    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="planning"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("migration_wave", sa.String(), nullable=True),
        sa.Column("profile_owner", sa.String(), nullable=True),
        sa.Column("jira_ticket", sa.String(), nullable=True),
        sa.Column("jira_base_url", sa.String(), nullable=True),
        sa.Column("last_updated", sa.String(), nullable=True),
        sa.Column("wave_id", sa.String(), sa.ForeignKey("waves.id"), nullable=True),
        sa.Column("jira_story_key", sa.String(), nullable=True),
        sa.Column("jira_job_status", sa.String(), nullable=True),
        sa.Column("jira_subtask_config", JSONB, nullable=True),
        sa.Column("application_overview", JSONB, nullable=True),
        sa.Column("availability", JSONB, nullable=True),
        sa.Column("data_persistence", JSONB, nullable=True),
        sa.Column("dependencies", JSONB, nullable=True),
        sa.Column("nfrs", JSONB, nullable=True),
        sa.Column("migration_constraints", JSONB, nullable=True),
        sa.Column("target_architecture", JSONB, nullable=True),
        sa.Column("team", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 4. project_users (FK → projects, users)
    op.create_table(
        "project_users",
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role", sa.String(), nullable=True),
    )

    # 5. cloud_resources (FK → projects)
    op.create_table(
        "cloud_resources",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("product", sa.String(), nullable=True),
        sa.Column("resource_set", sa.String(), nullable=True),
        sa.Column("specs", JSONB, nullable=True),
        sa.Column("sub_application", sa.String(), nullable=True),
        sa.Column("target_resource_id", sa.String(), nullable=True),
        sa.Column("sync_status", sa.String(), nullable=False, server_default="out-of-sync"),
        sa.Column("need_migration", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("jira_subtask_key", sa.String(), nullable=True),
    )
    op.create_index("ix_cloud_resources_project_id", "cloud_resources", ["project_id"])

    # 6. risks (FK → projects)
    op.create_table(
        "risks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False, server_default=""),
        sa.Column("severity", sa.String(), nullable=False, server_default="medium"),
        sa.Column("mitigation", sa.String(), nullable=True),
        sa.Column("owner", sa.String(), nullable=True),
        sa.Column("risk_status", sa.String(), nullable=True),
    )

    # 7. approvals (FK → projects)
    op.create_table(
        "approvals",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("approver", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("timestamp", sa.String(), nullable=True),
        sa.Column("icon", sa.String(), nullable=False, server_default=""),
        sa.Column("user_id", sa.String(), nullable=True),
    )

    # 8. audit_log_entries (FK → projects)
    op.create_table(
        "audit_log_entries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("actor", JSONB, nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=True),
        sa.Column("entity_label", sa.String(), nullable=True),
        sa.Column("section_key", sa.String(), nullable=True),
        sa.Column("section_label", sa.String(), nullable=True),
        sa.Column("changes", JSONB, nullable=False, server_default="[]"),
    )
    op.create_index("ix_audit_log_entries_project_id", "audit_log_entries", ["project_id"])

    # 9. embargo_records
    op.create_table(
        "embargo_records",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_date", sa.String(), nullable=False),
        sa.Column("end_date", sa.String(), nullable=False),
        sa.Column("affected_service_lines", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 10. billing_records — composite PK (month, env, resource_set)
    op.create_table(
        "billing_records",
        sa.Column("month", sa.String(7), primary_key=True),
        sa.Column("env", sa.String(), primary_key=True),
        sa.Column("resource_set", sa.String(), primary_key=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
    )
    op.create_index("ix_billing_records_month_env", "billing_records", ["month", "env"])

    # 11. jira_jobs (FK → projects)
    op.create_table(
        "jira_jobs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("config", JSONB, nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("story_key", sa.String(), nullable=True),
        sa.Column("subtask_keys", JSONB, nullable=False, server_default="{}"),
    )
    op.create_index("ix_jira_jobs_project_id", "jira_jobs", ["project_id"])

    # 12. config_store — key/value singleton table
    op.create_table(
        "config_store",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", JSONB, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 13. email_templates
    op.create_table(
        "email_templates",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("recipient_list", JSONB, nullable=False, server_default="[]"),
        sa.Column("template_style", JSONB, nullable=False, server_default="{}"),
        sa.Column("rows", JSONB, nullable=False, server_default="[]"),
        sa.Column("is_predefined", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("email_templates")
    op.drop_table("config_store")
    op.drop_index("ix_jira_jobs_project_id", "jira_jobs")
    op.drop_table("jira_jobs")
    op.drop_index("ix_billing_records_month_env", "billing_records")
    op.drop_table("billing_records")
    op.drop_table("embargo_records")
    op.drop_index("ix_audit_log_entries_project_id", "audit_log_entries")
    op.drop_table("audit_log_entries")
    op.drop_table("approvals")
    op.drop_table("risks")
    op.drop_index("ix_cloud_resources_project_id", "cloud_resources")
    op.drop_table("cloud_resources")
    op.drop_table("project_users")
    op.drop_table("projects")
    op.drop_table("waves")
    op.drop_table("users")
