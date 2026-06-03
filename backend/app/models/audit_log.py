from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuditLogEntry(Base):
    __tablename__ = "audit_log_entries"
    __table_args__ = (Index("ix_audit_log_entries_project_id", "project_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actor: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    entity_label: Mapped[str | None] = mapped_column(String, nullable=True)
    section_key: Mapped[str | None] = mapped_column(String, nullable=True)
    section_label: Mapped[str | None] = mapped_column(String, nullable=True)
    old_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    changes: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)

    project: Mapped["Project"] = relationship("Project", back_populates="audit_logs")
