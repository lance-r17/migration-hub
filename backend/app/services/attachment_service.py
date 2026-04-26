import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.project_attachment import ProjectAttachment

logger = logging.getLogger(__name__)

# ─── Status constants ─────────────────────────────────────────────────────────

STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_DELETED = "deleted"

# ─── Public service functions ─────────────────────────────────────────────────


async def confirm_attachments(
    session: AsyncSession,
    project_id: str,
    attachment_ids: list[str],
) -> None:
    """Transition matching pending attachments to confirmed."""
    if not attachment_ids:
        return

    result = await session.execute(
        select(ProjectAttachment).where(
            ProjectAttachment.project_id == project_id,
            ProjectAttachment.id.in_(attachment_ids),
            ProjectAttachment.status == STATUS_PENDING,
        )
    )
    attachments = result.scalars().all()
    now = datetime.now(timezone.utc)
    for att in attachments:
        att.status = STATUS_CONFIRMED
        att.updated_at = now
    if attachments:
        logger.info(
            "Confirmed %d attachment(s) for project %s",
            len(attachments),
            project_id,
        )


async def soft_delete_attachment(
    session: AsyncSession,
    project_id: str,
    attachment_id: str,
) -> ProjectAttachment | None:
    """Soft-delete an attachment. Returns the attachment or None if not found."""
    result = await session.execute(
        select(ProjectAttachment).where(
            ProjectAttachment.id == attachment_id,
            ProjectAttachment.project_id == project_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        return None

    attachment.status = STATUS_DELETED
    attachment.updated_at = datetime.now(timezone.utc)
    logger.info(
        "Soft-deleted attachment %s for project %s",
        attachment_id,
        project_id,
    )
    return attachment


async def hard_delete_attachment(
    session: AsyncSession,
    attachment: ProjectAttachment,
) -> None:
    """Permanently remove an attachment from DB and disk."""
    file_path = attachment.file_path
    await session.delete(attachment)
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info("Removed attachment file: %s", file_path)
        except OSError as e:
            logger.warning("Failed to remove attachment file %s: %s", file_path, e)


async def get_all_attachments(
    session: AsyncSession,
    status_filter: str | None = None,
) -> list[ProjectAttachment]:
    """Return all attachments across all projects, optionally filtered by status.

    Results are ordered by created_at descending.
    """
    stmt = select(ProjectAttachment).order_by(ProjectAttachment.created_at.desc())
    if status_filter:
        stmt = stmt.where(ProjectAttachment.status == status_filter)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def bulk_hard_delete_attachments(
    session: AsyncSession,
    attachment_ids: list[str],
) -> dict[str, int | list[str]]:
    """Permanently delete the given attachments from DB and disk.

    Returns {'deleted': int, 'not_found': list[str]}
    """
    if not attachment_ids:
        return {"deleted": 0, "not_found": []}

    result = await session.execute(
        select(ProjectAttachment).where(ProjectAttachment.id.in_(attachment_ids))
    )
    attachments = {a.id: a for a in result.scalars().all()}

    deleted = 0
    not_found: list[str] = []

    for att_id in attachment_ids:
        attachment = attachments.get(att_id)
        if attachment is None:
            not_found.append(att_id)
            continue
        await hard_delete_attachment(session, attachment)
        deleted += 1

    return {"deleted": deleted, "not_found": not_found}


async def cleanup_orphaned_attachments(session: AsyncSession) -> dict[str, int]:
    """Hard-delete stale pending and soft-deleted attachments.

    Returns a dict with counts: {'pending_removed': N, 'deleted_removed': M}
    """
    now = datetime.now(timezone.utc)
    removed = {"pending_removed": 0, "deleted_removed": 0}

    # Remove pending attachments older than 24 hours
    pending_cutoff = now - timedelta(hours=24)
    result = await session.execute(
        select(ProjectAttachment).where(
            ProjectAttachment.status == STATUS_PENDING,
            ProjectAttachment.created_at < pending_cutoff,
        )
    )
    pending_stale = result.scalars().all()
    for att in pending_stale:
        await hard_delete_attachment(session, att)
    removed["pending_removed"] = len(pending_stale)
    if pending_stale:
        logger.info("Cleaned up %d stale pending attachment(s)", len(pending_stale))

    # Remove soft-deleted attachments older than 7 days
    deleted_cutoff = now - timedelta(days=7)
    result = await session.execute(
        select(ProjectAttachment).where(
            ProjectAttachment.status == STATUS_DELETED,
            ProjectAttachment.updated_at < deleted_cutoff,
        )
    )
    deleted_stale = result.scalars().all()
    for att in deleted_stale:
        await hard_delete_attachment(session, att)
    removed["deleted_removed"] = len(deleted_stale)
    if deleted_stale:
        logger.info("Cleaned up %d stale deleted attachment(s)", len(deleted_stale))

    return removed


# ─── Background monitor ───────────────────────────────────────────────────────


async def start_cleanup_monitor(poll_interval_hours: int = 1) -> None:
    """Periodic background monitor: clean up orphaned attachments.

    Sleeps first so any startup logic runs immediately without waiting
    for the first tick. Cancel the returned task to stop the monitor.
    """
    tick = 0
    try:
        while True:
            await asyncio.sleep(poll_interval_hours * 3600)
            tick += 1
            logger.debug("attachment_cleanup_monitor: tick #%d", tick)
            async with AsyncSessionLocal() as session:
                removed = await cleanup_orphaned_attachments(session)
                await session.commit()
                total = removed["pending_removed"] + removed["deleted_removed"]
                if total:
                    logger.info(
                        "attachment_cleanup_monitor: removed %d attachment(s) "
                        "(%d pending, %d deleted)",
                        total,
                        removed["pending_removed"],
                        removed["deleted_removed"],
                    )
    except asyncio.CancelledError:
        logger.info("attachment_cleanup_monitor: cancelled after %d tick(s)", tick)
        raise
