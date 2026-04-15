from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CloudResource(Base):
    __tablename__ = "cloud_resources"
    __table_args__ = (Index("ix_cloud_resources_project_id", "project_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    product: Mapped[str | None] = mapped_column(String, nullable=True)
    resource_set: Mapped[str | None] = mapped_column(String, nullable=True)
    specs: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    sub_application: Mapped[str | None] = mapped_column(String, nullable=True)
    target_resource_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sync_status: Mapped[str] = mapped_column(String, nullable=False, default="out-of-sync")
    need_migration: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    jira_subtask_key: Mapped[str | None] = mapped_column(String, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="cloud_resources")
