from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class JiraJob(Base):
    __tablename__ = "jira_jobs"
    __table_args__ = (Index("ix_jira_jobs_project_id", "project_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    wave_epic_key: Mapped[str | None] = mapped_column(String, nullable=True)
    story_key: Mapped[str | None] = mapped_column(String, nullable=True)
    subtask_keys: Mapped[dict[str, str]] = mapped_column(JSONB, nullable=False, default=dict)

    project: Mapped["Project"] = relationship("Project", back_populates="jira_jobs")
