from pydantic import BaseModel


class SignoffConfigOut(BaseModel):
    enabled: bool


class SignoffConfigUpdate(BaseModel):
    enabled: bool
