from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Engagement(Base, TimestampMixin):
    __tablename__ = "engagements"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String, ForeignKey("projects.id"), nullable=False, unique=True
    )
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    interview_subject: Mapped[str | None] = mapped_column(String, nullable=True)
    engagement_manager_id: Mapped[str | None] = mapped_column(String, nullable=True)
    confluence_page_id: Mapped[str | None] = mapped_column(String, nullable=True)
    confluence_page_url: Mapped[str | None] = mapped_column(String, nullable=True)
    zoom_meeting_url: Mapped[str | None] = mapped_column(String, nullable=True)
    zoom_meeting_id: Mapped[str | None] = mapped_column(String, nullable=True)
    planned_slots: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    participant_ids: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[list | str | None] = mapped_column(JSONB, nullable=True)

    project: Mapped["Project"] = relationship(
        "Project", back_populates="engagement", uselist=False
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "status": self.status,
            "interviewSubject": self.interview_subject,
            "plannedSlots": self.planned_slots,
            "participantIds": self.participant_ids,
            "engagementManagerId": self.engagement_manager_id,
            "notes": self.notes,
            "confluencePageId": self.confluence_page_id,
            "confluencePageUrl": self.confluence_page_url,
            "zoomMeetingUrl": self.zoom_meeting_url,
            "zoomMeetingId": self.zoom_meeting_id,
        }
