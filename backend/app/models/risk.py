from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    severity: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    mitigation: Mapped[str | None] = mapped_column(String, nullable=True)
    owner: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_status: Mapped[str | None] = mapped_column(String, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="risks")
