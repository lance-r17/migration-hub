from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    department: Mapped[str] = mapped_column(String, nullable=False)
    team: Mapped[str | None] = mapped_column(String, nullable=True)
    initials: Mapped[str] = mapped_column(String(10), nullable=False)
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    is_service_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    api_key_hash: Mapped[str | None] = mapped_column(String, nullable=True)

    project_users: Mapped[list["ProjectUser"]] = relationship("ProjectUser", back_populates="user")
