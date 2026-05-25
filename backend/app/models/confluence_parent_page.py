from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ConfluenceParentPage(Base, TimestampMixin):
    __tablename__ = "confluence_parent_pages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    space_key: Mapped[str] = mapped_column(String, nullable=False)
    page_id: Mapped[str] = mapped_column(String, nullable=False)
