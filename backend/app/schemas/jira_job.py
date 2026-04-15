from typing import Any

from pydantic import BaseModel, ConfigDict


class JiraJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    status: str
    config: dict[str, Any]
    requested_at: str | None = None
    processed_at: str | None = None
    story_key: str | None = None
    subtask_keys: dict[str, str] = {}

    @classmethod
    def from_orm_job(cls, job: Any) -> "JiraJobOut":
        return cls(
            id=job.id,
            project_id=job.project_id,
            status=job.status,
            config=job.config,
            requested_at=job.requested_at.isoformat() if job.requested_at else None,
            processed_at=job.processed_at.isoformat() if job.processed_at else None,
            story_key=job.story_key,
            subtask_keys=job.subtask_keys or {},
        )


class JiraJobCreate(BaseModel):
    project_id: str
    config: dict[str, Any]
    wave_epic_key: str | None = None
