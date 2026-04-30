"""Migrate profile_owner to project_users itso role and drop column

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Migrate existing profile_owner values into project_users as itso
    projects_table = sa.table(
        "projects",
        sa.column("id", sa.String),
        sa.column("profile_owner", sa.String),
    )
    project_users_table = sa.table(
        "project_users",
        sa.column("project_id", sa.String),
        sa.column("user_id", sa.String),
        sa.column("role", sa.String),
    )

    connection = op.get_bind()
    projects = connection.execute(
        sa.select(projects_table.c.id, projects_table.c.profile_owner)
        .where(projects_table.c.profile_owner.is_not(None))
    ).fetchall()

    for project_id, user_id in projects:
        row = connection.execute(
            sa.select(project_users_table.c.role)
            .where(
                (project_users_table.c.project_id == project_id)
                & (project_users_table.c.user_id == user_id)
            )
        ).fetchone()

        if row is not None:
            existing_role = row[0]
            roles = {r.strip() for r in (existing_role or "").split(",") if r.strip()}
            roles.add("itso")
            new_role = ",".join(sorted(roles))
            connection.execute(
                project_users_table.update()
                .where(
                    (project_users_table.c.project_id == project_id)
                    & (project_users_table.c.user_id == user_id)
                )
                .values(role=new_role)
            )
        else:
            connection.execute(
                project_users_table.insert().values(
                    project_id=project_id, user_id=user_id, role="itso"
                )
            )

    # 2. Drop the foreign-key constraint and column
    op.drop_constraint(
        constraint_name="fk_projects_profile_owner_users",
        table_name="projects",
        type_="foreignkey",
    )
    op.drop_column("projects", "profile_owner")


def downgrade() -> None:
    # 1. Re-add the column
    op.add_column(
        "projects",
        sa.Column("profile_owner", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        constraint_name="fk_projects_profile_owner_users",
        source_table="projects",
        referent_table="users",
        local_cols=["profile_owner"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # 2. Restore the first itso user per project back to profile_owner
    project_users_table = sa.table(
        "project_users",
        sa.column("project_id", sa.String),
        sa.column("user_id", sa.String),
        sa.column("role", sa.String),
    )
    projects_table = sa.table(
        "projects",
        sa.column("id", sa.String),
        sa.column("profile_owner", sa.String),
    )

    connection = op.get_bind()
    rows = connection.execute(
        sa.select(project_users_table.c.project_id, project_users_table.c.user_id)
        .where(project_users_table.c.role.like("%itso%"))
    ).fetchall()

    for project_id, user_id in rows:
        connection.execute(
            projects_table.update()
            .where(projects_table.c.id == project_id)
            .values(profile_owner=user_id)
        )
