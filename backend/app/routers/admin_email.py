from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.email_job import EmailJob
from app.models.user import User
from app.services.cutover_reminder_service import (
    enqueue_cutover_reminders,
    scan_and_enqueue,
    scan_cutover_reminders,
)
from app.services.email_event_config_service import get_email_event_config, set_email_event_config
from app.services.email_service import process_email_job
from app.services.milestone_reminder_service import (
    enqueue_milestone_reminders,
    scan_milestone_reminders,
)

router = APIRouter(prefix="/admin/email", tags=["admin-email"])


@router.get("/events/config")
async def get_event_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Get email event configuration (cron settings, enabled flags)."""
    return await get_email_event_config(db)


@router.put("/events/config")
async def update_event_config(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Update email event configuration."""
    return await set_email_event_config(db, body)


@router.post("/events/cutover-reminder/trigger")
async def trigger_cutover_reminder(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Manually trigger a cutover reminder scan."""
    enqueued = await scan_and_enqueue(db)
    await db.commit()
    return {"enqueued": len(enqueued), "job_ids": enqueued}


@router.get("/events/cutover-reminder/scan")
async def scan_cutover_reminder_events(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Dry-run scan: list matching cutover reminders without enqueueing.

    Manual scan works regardless of the enabled toggle and matches any
    upcoming cutover within the configured reminder window (not only
    exact reminder days).
    """
    matches = await scan_cutover_reminders(db, respect_enabled=False, exact_days=False)
    return {
        "items": [
            {
                "waveId": m["wave_id"],
                "waveName": m["wave_name"],
                "cutoverDate": m["cutover_date"],
                "daysUntil": m["days_until"],
                "projectId": m["project_id"],
                "projectName": m["project_name"],
                "toAddrs": m["to_addrs"],
                "recipients": m["recipients"],
                "subject": m["subject"],
                "alreadyEnqueued": m["already_enqueued"],
            }
            for m in matches
        ]
    }


@router.post("/events/cutover-reminder/enqueue")
async def enqueue_cutover_reminder_events(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Enqueue cutover reminders only for the selected wave/project pairs.

    Each selection may include a "recipients" list overriding the resolved
    recipients (entries removed in the UI are excluded)."""
    selections = body.get("selections", [])
    sel_map = {(s.get("wave_id"), s.get("project_id")): s.get("recipients") for s in selections}

    matches = await scan_cutover_reminders(db, respect_enabled=False, exact_days=False)
    chosen = []
    for m in matches:
        key = (m["wave_id"], m["project_id"])
        if key not in sel_map:
            continue
        override = sel_map[key]
        if override is not None:
            if not override:
                continue  # all recipients removed
            m["to_addrs"] = override
        chosen.append(m)

    job_ids = await enqueue_cutover_reminders(db, chosen)
    await db.commit()
    return {"enqueued": len(job_ids), "job_ids": job_ids}


@router.get("/events/milestone-reminder/scan")
async def scan_milestone_reminder_events(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Dry-run scan: list due milestone reminders without enqueueing.

    Manual scan works regardless of the enabled toggle.
    """
    matches = await scan_milestone_reminders(db, respect_enabled=False)
    return {
        "items": [
            {
                "projectId": m["project_id"],
                "projectName": m["project_name"],
                "waveId": m["wave_id"],
                "waveName": m["wave_name"],
                "milestoneId": m["milestone_id"],
                "milestoneName": m["milestone_name"],
                "milestoneStatus": m["milestone_status"],
                "targetDate": m["target_date"],
                "daysUntil": m["days_until"],
                "toAddrs": m["to_addrs"],
                "recipients": m["recipients"],
                "subject": m["subject"],
                "onCooldown": m["on_cooldown"],
                "lastSentAt": m["last_sent_at"],
            }
            for m in matches
        ]
    }


@router.post("/events/milestone-reminder/enqueue")
async def enqueue_milestone_reminder_events(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Enqueue milestone reminders only for the selected project/milestone pairs.

    Each selection may include a "recipients" list overriding the resolved
    recipients (entries removed in the UI are excluded)."""
    selections = body.get("selections", [])
    sel_map = {(s.get("project_id"), s.get("milestone_id")): s.get("recipients") for s in selections}

    matches = await scan_milestone_reminders(db, respect_enabled=False)
    chosen = []
    for m in matches:
        key = (m["project_id"], m["milestone_id"])
        if key not in sel_map:
            continue
        override = sel_map[key]
        if override is not None:
            if not override:
                continue  # all recipients removed
            m["to_addrs"] = override
        chosen.append(m)

    job_ids = await enqueue_milestone_reminders(db, chosen)
    await db.commit()
    return {"enqueued": len(job_ids), "job_ids": job_ids}


@router.get("/jobs")
async def list_email_jobs(
    status: str | None = None,
    event_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List email jobs with optional filters."""
    query = select(EmailJob).order_by(EmailJob.created_at.desc())
    if status:
        query = query.where(EmailJob.status == status)
    if event_type:
        query = query.where(EmailJob.event_type == event_type)

    total_result = await db.execute(query)
    total = len(total_result.scalars().all())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    jobs = result.scalars().all()

    def _job_out(j: EmailJob) -> dict[str, Any]:
        return {
            "id": j.id,
            "eventType": j.event_type,
            "templateId": j.template_id,
            "toAddrs": j.to_addrs,
            "subject": j.subject,
            "status": j.status,
            "errorMessage": j.error_message,
            "attempts": j.attempts,
            "idempotencyKey": j.idempotency_key,
            "createdAt": j.created_at.isoformat() if j.created_at else None,
            "sentAt": j.sent_at.isoformat() if j.sent_at else None,
        }

    return {
        "items": [_job_out(j) for j in jobs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/jobs/{job_id}/retry")
async def retry_email_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Reset a failed email job to pending and dispatch it immediately."""
    job = await db.get(EmailJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ("failed", "pending"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry job with status '{job.status}'",
        )

    job.status = "pending"
    job.error_message = None
    await db.flush()
    await db.commit()

    # Dispatch immediately in background
    import asyncio

    asyncio.create_task(process_email_job(job.id))

    return {"status": "retrying", "job_id": job.id}


@router.get("/jobs/{job_id}/preview")
async def preview_email_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return the rendered HTML body of an email job for preview."""
    job = await db.get(EmailJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "subject": job.subject,
        "toAddrs": job.to_addrs,
        "htmlBody": job.html_body,
    }


@router.delete("/jobs")
async def delete_email_jobs(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Bulk delete email jobs. If status is provided, only delete jobs with that status."""
    query = delete(EmailJob)
    if status:
        query = query.where(EmailJob.status == status)
    result = await db.execute(query)
    await db.commit()
    return {"deleted": result.rowcount}
