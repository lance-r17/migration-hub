from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LocalAccountCreate(BaseModel):
    account_name: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1)


class LocalAccountUpdate(BaseModel):
    password: str = Field(..., min_length=1)


class LocalAccountAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    account_name: str
    created_at: datetime
    updated_at: datetime


class LocalAccountOwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_name: str
    password: str
