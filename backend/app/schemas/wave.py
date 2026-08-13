from pydantic import BaseModel, ConfigDict


class JiraSubtaskConfig(BaseModel):
    mode: str
    selected_resource_ids: list[str] | None = None
    selected_categories: list[str] | None = None
    selected_products: list[str] | None = None


class WaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_date: str
    cutover_date: str
    description: str | None = None
    jira_project_key: str
    jira_epic_key: str | None = None
    jira_base_url: str | None = None
    source: str
    status: str
    color: str | None = None
    project_order: list[str] | None = None
    deleted: bool | None = None
    created_at: str | None = None

    @classmethod
    def from_orm_with_dates(cls, wave: "Wave") -> "WaveOut":  # noqa: F821
        obj = cls.model_validate(wave)
        if wave.created_at:
            obj.created_at = wave.created_at.isoformat()
        return obj


class WaveCreate(BaseModel):
    name: str
    start_date: str
    cutover_date: str
    description: str | None = None
    jira_project_key: str | None = None
    jira_epic_key: str | None = None
    source: str = "created"
    status: str = "planned"
    color: str | None = None


class WavePatch(BaseModel):
    name: str | None = None
    start_date: str | None = None
    cutover_date: str | None = None
    description: str | None = None
    jira_project_key: str | None = None
    jira_epic_key: str | None = None
    status: str | None = None
    color: str | None = None
    deleted: bool | None = None


class WaveImportRequest(BaseModel):
    epic_key: str
    color: str | None = None


class WaveBatchAssignRequest(BaseModel):
    project_ids: list[str]


class WaveBatchAssignOut(BaseModel):
    wave: WaveOut
    assigned: list[str]
    not_found: list[str]
