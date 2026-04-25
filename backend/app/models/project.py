from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="planning")
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    migration_wave: Mapped[str | None] = mapped_column(String, nullable=True)
    profile_owner: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    jira_ticket: Mapped[str | None] = mapped_column(String, nullable=True)
    jira_base_url: Mapped[str | None] = mapped_column(String, nullable=True)
    wave_id: Mapped[str | None] = mapped_column(String, ForeignKey("waves.id"), nullable=True)
    jira_story_key: Mapped[str | None] = mapped_column(String, nullable=True)
    jira_job_status: Mapped[str | None] = mapped_column(String, nullable=True)
    planning: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    survey_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # JSONB section columns
    application_overview: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    availability: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    data_persistence: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    dependencies: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    nfrs: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    migration_constraints: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    target_architecture: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    jira_subtask_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    profile_owner_user: Mapped["User | None"] = relationship("User")
    wave: Mapped["Wave | None"] = relationship("Wave", back_populates="projects")
    cloud_resources: Mapped[list["CloudResource"]] = relationship(
        "CloudResource", back_populates="project", cascade="all, delete-orphan"
    )
    risks: Mapped[list["Risk"]] = relationship(
        "Risk", back_populates="project", cascade="all, delete-orphan"
    )
    approvals: Mapped[list["Approval"]] = relationship(
        "Approval", back_populates="project", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLogEntry"]] = relationship(
        "AuditLogEntry", back_populates="project", cascade="all, delete-orphan"
    )
    project_users: Mapped[list["ProjectUser"]] = relationship(
        "ProjectUser", back_populates="project", cascade="all, delete-orphan"
    )
    jira_jobs: Mapped[list["JiraJob"]] = relationship(
        "JiraJob", back_populates="project", cascade="all, delete-orphan"
    )
