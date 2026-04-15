from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    approver: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    timestamp: Mapped[str | None] = mapped_column(String, nullable=True)
    icon: Mapped[str] = mapped_column(String, nullable=False, default="")
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="approvals")
