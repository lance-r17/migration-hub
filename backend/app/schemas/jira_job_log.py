from typing import Any

from pydantic import BaseModel


class JiraJobLogOut(BaseModel):
    id: str
    job_id: str
    timestamp: str
    level: str
    message: str
    meta: dict[str, Any] | None = None

    @classmethod
    def from_orm_log(cls, log: Any) -> "JiraJobLogOut":
        return cls(
            id=log.id,
            job_id=log.job_id,
            timestamp=log.timestamp.isoformat(),
            level=log.level,
            message=log.message,
            meta=log.meta,
        )
