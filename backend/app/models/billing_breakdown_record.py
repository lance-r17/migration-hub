from decimal import Decimal

from sqlalchemy import Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BillingBreakdownRecord(Base):
    __tablename__ = "billing_breakdown_records"
    __table_args__ = (Index("ix_billing_breakdown_month_env", "month", "env"),)

    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    env: Mapped[str] = mapped_column(String, primary_key=True)
    resource_set: Mapped[str] = mapped_column(String, primary_key=True)
    product: Mapped[str] = mapped_column(String, primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
