import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
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
    old_snapshot: dict[str, Any] | None = None,
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
        old_snapshot=old_snapshot,
        changes=changes or [],
    )
    session.add(entry)
    return entry


async def get_by_project(
    session: AsyncSession,
    project_id: str,
    limit: int | None = None,
    offset: int | None = None,
) -> list[AuditLogEntry]:
    stmt = (
        select(AuditLogEntry)
        .where(AuditLogEntry.project_id == project_id)
        .order_by(AuditLogEntry.timestamp.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    if offset is not None:
        stmt = stmt.offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, entry_id: str) -> AuditLogEntry | None:
    result = await session.execute(
        select(AuditLogEntry).where(AuditLogEntry.id == entry_id)
    )
    return result.scalar_one_or_none()


async def count_by_project(session: AsyncSession, project_id: str) -> int:
    result = await session.execute(
        select(func.count()).select_from(AuditLogEntry).where(AuditLogEntry.project_id == project_id)
    )
    return result.scalar() or 0


async def clear_by_project(session: AsyncSession, project_id: str) -> int:
    """Delete all audit log entries for a project. Returns count deleted."""
    from sqlalchemy import delete
    result = await session.execute(
        delete(AuditLogEntry).where(AuditLogEntry.project_id == project_id)
    )
    return result.rowcount
