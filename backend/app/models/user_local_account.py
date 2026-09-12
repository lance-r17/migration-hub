from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class UserLocalAccount(TimestampMixin, Base):
    __tablename__ = "user_local_accounts"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    account_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="local_account")
