"""Migrate role string values to snake_case

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users.role is comma-separated; use nested REPLACE to handle each token
    op.execute("""
        UPDATE users
        SET role = REPLACE(
            REPLACE(
                REPLACE(role, 'Platform Migration Lead', 'platform_migration_lead'),
                'Technical Lead', 'technical_lead'
            ),
            'Business Owner', 'business_owner'
        )
        WHERE role IS NOT NULL
    """)

    op.execute("""
        UPDATE approvals
        SET role = CASE role
            WHEN 'Platform Migration Lead' THEN 'platform_migration_lead'
            WHEN 'Technical Lead'          THEN 'technical_lead'
            WHEN 'Business Owner'          THEN 'business_owner'
            ELSE role
        END
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE users
        SET role = REPLACE(
            REPLACE(
                REPLACE(role, 'platform_migration_lead', 'Platform Migration Lead'),
                'technical_lead', 'Technical Lead'
            ),
            'business_owner', 'Business Owner'
        )
        WHERE role IS NOT NULL
    """)

    op.execute("""
        UPDATE approvals
        SET role = CASE role
            WHEN 'platform_migration_lead' THEN 'Platform Migration Lead'
            WHEN 'technical_lead'          THEN 'Technical Lead'
            WHEN 'business_owner'          THEN 'Business Owner'
            ELSE role
        END
    """)
