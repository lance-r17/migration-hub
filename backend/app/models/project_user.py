from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProjectUser(Base):
    __tablename__ = "project_users"

    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    role: Mapped[str | None] = mapped_column(String, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="project_users")
    user: Mapped["User"] = relationship("User", back_populates="project_users")
