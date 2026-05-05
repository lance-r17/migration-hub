from pydantic import BaseModel


class ServiceAccountCreate(BaseModel):
    name: str
    email: str
    department: str
    is_admin: bool | None = None


class ServiceAccountOut(BaseModel):
    id: str
    name: str
    email: str
    department: str
    initials: str
    is_admin: bool


class ServiceAccountUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    department: str | None = None
    is_admin: bool | None = None


class ServiceAccountCreated(BaseModel):
    id: str
    name: str
    email: str
    department: str
    initials: str
    is_admin: bool
    api_key: str  # plaintext — shown once, never stored


class ServiceAccountTokenReset(BaseModel):
    id: str
    api_key: str  # plaintext — shown once, never stored
