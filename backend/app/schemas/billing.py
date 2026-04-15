from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BillingRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    month: str
    env: str
    resource_set: str
    amount: float


class BillingRecordIn(BaseModel):
    resource_set: str
    amount: float


class BillingUpload(BaseModel):
    month: str
    env: str
    records: list[BillingRecordIn]


class BillingThresholdConfigOut(BaseModel):
    healthy_at_risk_threshold: float = 100.0
    at_risk_over_threshold: float = 120.0


class BillingThresholdConfigUpdate(BaseModel):
    healthy_at_risk_threshold: float | None = None
    at_risk_over_threshold: float | None = None
