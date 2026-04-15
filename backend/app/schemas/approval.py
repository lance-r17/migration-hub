from pydantic import BaseModel, ConfigDict


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    role: str
    approver: str | None = None
    status: str
    timestamp: str | None = None
    icon: str
    user_id: str | None = None


class ApprovalPatch(BaseModel):
    approver: str | None = None
    status: str | None = None
    timestamp: str | None = None
    user_id: str | None = None
