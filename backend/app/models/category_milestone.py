from datetime import datetime

from sqlalchemy import DateTime, String, Table, Column, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


project_category_milestone = Table(
    "project_category_milestone",
    Base.metadata,
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("category_milestone_id", String, ForeignKey("category_milestones.id", ondelete="CASCADE"), primary_key=True),
)


class CategoryMilestone(Base):
    __tablename__ = "category_milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[str] = mapped_column(String, nullable=False)
    end_date: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    projects: Mapped[list["Project"]] = relationship(
        "Project",
        secondary="project_category_milestone",
        back_populates="category_milestones",
    )
