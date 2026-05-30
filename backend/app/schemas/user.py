from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    department: str
    team: str | None = None
    initials: str
    role: str | None = None
    gbi_id: str | None = None


class UserCreate(BaseModel):
    id: str | None = None
    name: str
    email: str
    department: str
    team: str | None = None
    initials: str | None = None
    role: str | None = None


class GbiCloudLeadCreate(BaseModel):
    name: str
    email: str
    department: str
    team: str | None = None
    gbi_id: str | None = None


class BatchUserCreateRequest(BaseModel):
    users: list[UserCreate] = Field(..., min_length=1)


class BatchUserCreateResponse(BaseModel):
    created: int
    skipped: int
    users: list[UserOut]


class ProjectUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: str
    user_id: str
    role: str | None = None
    user: UserOut | None = None


class ProjectUserRoleAssignment(BaseModel):
    user_id: str
    roles: list[str]


class UserAdminUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    department: str | None = None
    team: str | None = None
    role: str | None = None
    gbi_id: str | None = None


class UserProjectRoleOut(BaseModel):
    user_id: str
    project_id: str
    project_name: str
    roles: list[str]


class LoginRequest(BaseModel):
    email: str
    password: str
