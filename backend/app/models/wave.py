from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Wave(Base, TimestampMixin):
    __tablename__ = "waves"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[str] = mapped_column(String, nullable=False)
    cutover_date: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    jira_project_key: Mapped[str] = mapped_column(String, nullable=False)
    jira_epic_key: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="created")
    status: Mapped[str] = mapped_column(String, nullable=False, default="planned")
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    project_order: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    projects: Mapped[list["Project"]] = relationship("Project", back_populates="wave")
