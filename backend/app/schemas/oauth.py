from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserOut


class SSOExchangeRequest(BaseModel):
    code: str


class SSOExchangeResponse(BaseModel):
    user: UserOut
    token: str


class SSOLoginUrlResponse(BaseModel):
    url: str
