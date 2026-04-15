from pydantic import BaseModel, ConfigDict


class RiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    description: str
    severity: str
    mitigation: str | None = None
    owner: str | None = None
    risk_status: str | None = None


class RiskCreate(BaseModel):
    id: str | None = None
    title: str
    description: str = ""
    severity: str = "medium"
    mitigation: str | None = None
    owner: str | None = None
    risk_status: str | None = None


class RiskPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    severity: str | None = None
    mitigation: str | None = None
    owner: str | None = None
    risk_status: str | None = None
