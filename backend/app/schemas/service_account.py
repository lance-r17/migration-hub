from pydantic import BaseModel


class ServiceAccountCreate(BaseModel):
    name: str
    email: str
    department: str


class ServiceAccountOut(BaseModel):
    id: str
    name: str
    email: str
    department: str
    initials: str


class ServiceAccountUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    department: str | None = None


class ServiceAccountCreated(BaseModel):
    id: str
    name: str
    email: str
    department: str
    initials: str
    api_key: str  # plaintext — shown once, never stored


class ServiceAccountTokenReset(BaseModel):
    id: str
    api_key: str  # plaintext — shown once, never stored
