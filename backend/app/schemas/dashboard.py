from pydantic import BaseModel


class OverallStatsOut(BaseModel):
    progress: float
    total_assets: int
    target_cloud: str
    completed: int
    in_progress: int


class ActivityOut(BaseModel):
    id: str
    type: str
    message: str
    time: str
    actor: str
    project_id: str | None = None
    project_name: str | None = None


class ActivityListOut(BaseModel):
    items: list[ActivityOut]
