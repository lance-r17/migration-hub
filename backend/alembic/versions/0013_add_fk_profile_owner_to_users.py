"""Add FK constraint on projects.profile_owner -> users.id

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-24 08:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Map known legacy free-text values to user IDs.
PROFILE_OWNER_MAP = {
    "Dan Brown, Platform Engineering": "u2",
    "Frank Miller, Platform Security": "u6",
    "Henry Wilson, Network Operations": "u9",
}


def upgrade() -> None:
    # 1. Clean existing data: map known text values to user IDs,
    #    nullify anything else so the FK constraint can be added safely.
    projects_table = sa.table(
        "projects",
        sa.column("profile_owner", sa.String),
    )

    for old_value, user_id in PROFILE_OWNER_MAP.items():
        op.execute(
            projects_table.update()
            .where(projects_table.c.profile_owner == old_value)
            .values(profile_owner=user_id)
        )

    # Nullify any remaining values that don't reference a valid user id.
    op.execute(
        "UPDATE projects SET profile_owner = NULL "
        "WHERE profile_owner NOT IN (SELECT id FROM users)"
    )

    # 2. Add the foreign-key constraint.
    op.create_foreign_key(
        constraint_name="fk_projects_profile_owner_users",
        source_table="projects",
        referent_table="users",
        local_cols=["profile_owner"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        constraint_name="fk_projects_profile_owner_users",
        table_name="projects",
        type_="foreignkey",
    )
