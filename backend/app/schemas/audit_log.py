from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditActor(BaseModel):
    id: str
    name: str
    initials: str


class AuditChange(BaseModel):
    field: str
    label: str
    old_value: Any = None
    new_value: Any = None


class AuditLogEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    timestamp: str
    actor: dict[str, Any]
    event_type: str
    entity_type: str
    entity_id: str | None = None
    entity_label: str | None = None
    section_key: str | None = None
    section_label: str | None = None
    old_snapshot: dict[str, Any] | None = None
    changes: list[dict[str, Any]] = []

    @classmethod
    def from_orm_entry(cls, entry: Any) -> "AuditLogEntryOut":
        return cls(
            id=entry.id,
            project_id=entry.project_id,
            timestamp=entry.timestamp.isoformat() if entry.timestamp else "",
            actor=entry.actor,
            event_type=entry.event_type,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            entity_label=entry.entity_label,
            section_key=entry.section_key,
            section_label=entry.section_label,
            old_snapshot=entry.old_snapshot,
            changes=entry.changes or [],
        )


class AuditLogResponse(BaseModel):
    entries: list[AuditLogEntryOut]
    total: int
    limit: int | None = None
    offset: int | None = None
