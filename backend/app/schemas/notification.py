from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    message: str
    link: str | None = None
    read_at: datetime | None = None
    created_at: datetime


class UnreadCountOut(BaseModel):
    count: int


class NotificationConfig(BaseModel):
    retention_limit: int = Field(..., ge=1)
