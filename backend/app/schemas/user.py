from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    department: str
    team: str | None = None
    initials: str
    role: str | None = None


class ProjectUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: str
    user_id: str
    role: str | None = None
    user: UserOut | None = None


class LoginRequest(BaseModel):
    email: str
    password: str
