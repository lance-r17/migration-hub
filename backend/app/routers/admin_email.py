from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.email_job import EmailJob
from app.models.user import User
from app.services.cutover_reminder_service import scan_and_enqueue
from app.services.email_event_config_service import get_email_event_config, set_email_event_config
from app.services.email_service import process_email_job

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
