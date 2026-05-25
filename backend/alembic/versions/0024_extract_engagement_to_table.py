"""Extract engagement JSONB into a dedicated engagements table

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "engagements",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("interview_subject", sa.String(), nullable=True),
        sa.Column("engagement_manager_id", sa.String(), nullable=True),
        sa.Column("confluence_page_url", sa.String(), nullable=True),
        sa.Column("zoom_meeting_url", sa.String(), nullable=True),
        sa.Column("zoom_meeting_id", sa.String(), nullable=True),
        sa.Column("planned_slots", JSONB, nullable=True),
        sa.Column("participant_ids", JSONB, nullable=True),
        sa.Column("notes", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )

    op.execute(
        """
        INSERT INTO engagements (
            id, project_id, status, interview_subject, engagement_manager_id,
            confluence_page_url, zoom_meeting_url, zoom_meeting_id,
            planned_slots, participant_ids, notes,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid()::text,
            id,
            engagement->>'status',
            engagement->>'interviewSubject',
            engagement->>'engagementManagerId',
            engagement->>'confluencePageUrl',
            engagement->>'zoomMeetingUrl',
            engagement->>'zoomMeetingId',
            engagement->'plannedSlots',
            engagement->'participantIds',
            engagement->'notes',
            now(),
            now()
        FROM projects
        WHERE engagement IS NOT NULL;
        """
    )

    op.drop_column("projects", "engagement")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("engagement", JSONB, nullable=True),
    )

    op.execute(
        """
        UPDATE projects p
        SET engagement = (
            SELECT jsonb_strip_nulls(jsonb_build_object(
                'status', e.status,
                'interviewSubject', e.interview_subject,
                'engagementManagerId', e.engagement_manager_id,
                'confluencePageUrl', e.confluence_page_url,
                'zoomMeetingUrl', e.zoom_meeting_url,
                'zoomMeetingId', e.zoom_meeting_id,
                'plannedSlots', e.planned_slots,
                'participantIds', e.participant_ids,
                'notes', e.notes
            ))
            FROM engagements e
            WHERE e.project_id = p.id
        )
        WHERE EXISTS (
            SELECT 1 FROM engagements e WHERE e.project_id = p.id
        );
        """
    )

    op.drop_table("engagements")
