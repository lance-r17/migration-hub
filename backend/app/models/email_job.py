from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class EmailJob(Base):
    __tablename__ = "email_jobs"
    __table_args__ = (
        Index("ix_email_jobs_status", "status"),
        Index("ix_email_jobs_event_type", "event_type"),
        Index("ix_email_jobs_idempotency_key", "idempotency_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    template_id: Mapped[str] = mapped_column(
        String, ForeignKey("email_templates.id"), nullable=False
    )
    to_addrs: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    html_body: Mapped[str] = mapped_column(String, nullable=False)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
