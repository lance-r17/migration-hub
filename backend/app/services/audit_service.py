import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLogEntry


async def append_entry(
    session: AsyncSession,
    project_id: str,
    event_type: str,
    entity_type: str,
    actor: dict[str, Any],
    changes: list[dict[str, Any]] | None = None,
    entity_id: str | None = None,
    entity_label: str | None = None,
    section_key: str | None = None,
    section_label: str | None = None,
) -> AuditLogEntry:
    entry = AuditLogEntry(
        id=str(uuid.uuid4()),
        project_id=project_id,
        timestamp=datetime.now(timezone.utc),
        actor=actor,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        section_key=section_key,
        section_label=section_label,
        changes=changes or [],
    )
    session.add(entry)
    return entry


async def get_by_project(
    session: AsyncSession, project_id: str
) -> list[AuditLogEntry]:
    result = await session.execute(
        select(AuditLogEntry)
        .where(AuditLogEntry.project_id == project_id)
        .order_by(AuditLogEntry.timestamp.desc())
    )
    return list(result.scalars().all())


async def clear_by_project(session: AsyncSession, project_id: str) -> int:
    """Delete all audit log entries for a project. Returns count deleted."""
    from sqlalchemy import delete
    result = await session.execute(
        delete(AuditLogEntry).where(AuditLogEntry.project_id == project_id)
    )
    return result.rowcount
