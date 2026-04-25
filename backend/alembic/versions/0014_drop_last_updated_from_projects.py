"""Drop last_updated column from projects

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-24 08:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("projects", "last_updated")


def downgrade() -> None:
    op.add_column(
        "projects",
        op.Column("last_updated", sa.String(), nullable=True),
    )
