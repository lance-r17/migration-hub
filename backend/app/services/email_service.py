import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone

import aiosmtplib
from email.message import EmailMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.email_job import EmailJob

logger = logging.getLogger(__name__)

# In-flight email job IDs (mirrors jira_service._dispatched)
_dispatched: set[str] = set()


_VARIABLE_RE = re.compile(r"\{\{(\w+(?:\.\w+)?)\}\}")


def render_snapshot(*, html_snapshot: str, context: dict) -> str:
    """Substitute {{var}} and {{dot.path}} placeholders in html_snapshot."""

    def _replacer(match: re.Match) -> str:
        key = match.group(1)
        if "." in key:
            obj_name, attr = key.split(".", 1)
            obj = context.get(obj_name, {})
            if isinstance(obj, dict):
                return str(obj.get(attr, match.group(0)))
            return str(getattr(obj, attr, match.group(0)))
        return str(context.get(key, match.group(0)))

    return _VARIABLE_RE.sub(_replacer, html_snapshot)


async def enqueue_email(
    session: AsyncSession,
    *,
    event_type: str,
    template_id: str,
    to_addrs: list[str],
    subject: str,
    html_body: str,
    context: dict,
    idempotency_key: str | None = None,
) -> EmailJob:
    """Create an EmailJob row. Caller is responsible for commit."""
    if idempotency_key:
        existing = await session.scalar(
            select(EmailJob).where(EmailJob.idempotency_key == idempotency_key)
        )
        if existing:
            logger.info(
                "enqueue_email skipped: idempotency_key=%s already exists (%s)",
                idempotency_key,
                existing.id,
            )
            return existing

    job = EmailJob(
        id=f"email-job-{uuid.uuid4().hex[:12]}",
        event_type=event_type,
        template_id=template_id,
        to_addrs=to_addrs,
        subject=subject,
        html_body=html_body,
        context=context,
        status="pending",
        idempotency_key=idempotency_key,
    )
    session.add(job)
    await session.flush()
    logger.info(
        "enqueue_email: created %s event=%s to=%s",
        job.id,
        event_type,
        to_addrs,
    )
    return job


async def process_email_job(job_id: str) -> None:
    """Background task: send the email and update status."""
    logger.info("process_email_job started: %s", job_id)
    _dispatched.add(job_id)
    try:
        async with AsyncSessionLocal() as session:
            job = await session.get(EmailJob, job_id)
            if not job:
                logger.warning("process_email_job: job not found: %s", job_id)
                return

            job.status = "processing"
            job.attempts = (job.attempts or 0) + 1
            await session.flush()
            await session.commit()

            try:
                await send_email(
                    to_addrs=job.to_addrs,
                    subject=job.subject,
                    html_content=job.html_body,
                )
                job.status = "sent"
                job.sent_at = datetime.now(timezone.utc)
                job.error_message = None
                logger.info("process_email_job sent: %s", job_id)
            except Exception as exc:
                logger.exception("process_email_job failed: %s", job_id)
                job.status = "failed"
                job.error_message = f"{type(exc).__name__}: {exc}"

            await session.commit()
    finally:
        _dispatched.discard(job_id)


async def dispatch_pending_email_jobs(session: AsyncSession) -> list[str]:
    """Query pending email jobs and schedule those not already dispatched."""
    result = await session.execute(
        select(EmailJob).where(EmailJob.status == "pending")
    )
    pending = result.scalars().all()
    dispatched: list[str] = []
    for job in pending:
        if job.id in _dispatched:
            logger.debug(
                "dispatch_pending_email_jobs: skipping %s (already in-flight)", job.id
            )
            continue
        asyncio.create_task(process_email_job(job.id))
        dispatched.append(job.id)
    if dispatched:
        logger.info(
            "dispatch_pending_email_jobs: dispatched %d job(s): %s",
            len(dispatched),
            dispatched,
        )
    return dispatched


async def start_email_job_monitor(poll_interval_seconds: int = 30) -> None:
    """Periodic background monitor for pending email jobs."""
    tick = 0
    try:
        while True:
            await asyncio.sleep(poll_interval_seconds)
            tick += 1
            logger.debug("email_job_monitor: tick #%d", tick)
            async with AsyncSessionLocal() as session:
                dispatched = await dispatch_pending_email_jobs(session)
                if dispatched:
                    await session.commit()
    except asyncio.CancelledError:
        logger.info("email_job_monitor: cancelled after %d tick(s)", tick)
        raise


async def send_email(
    *,
    to_addrs: list[str],
    subject: str,
    html_content: str,
    from_addr: str | None = None,
) -> None:
    """Send an HTML email via the configured SMTP server."""
    if not to_addrs:
        raise ValueError("At least one recipient is required")

    sender = from_addr or settings.smtp_from or settings.smtp_user or "no-reply@localhost"

    if settings.console_email:
        logger.info(
            "\n========== CONSOLE EMAIL ==========\n"
            "From:    %s\n"
            "To:      %s\n"
            "Subject: %s\n"
            "-----------------------------------\n"
            "%s\n"
            "===================================",
            sender, ", ".join(to_addrs), subject, html_content[:2000],
        )
        return

    if not settings.smtp_host:
        raise RuntimeError("SMTP host is not configured")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = ", ".join(to_addrs)
    message["Subject"] = subject
    message.add_alternative(html_content, subtype="html")

    try:
        if settings.smtp_port == 465 or settings.smtp_secure:
            # Implicit TLS (SSL from connect) — port 465 or explicit secure flag
            client = aiosmtplib.SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                use_tls=True,
            )
            async with client:
                if settings.smtp_user:
                    await client.login(settings.smtp_user, settings.smtp_password or "")
                await client.send_message(message)
        else:
            # STARTTLS — port 587 (default)
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user or None,
                password=settings.smtp_password or None,
                start_tls=True,
            )
    except aiosmtplib.errors.SMTPConnectError as exc:
        raise RuntimeError(
            f"Cannot connect to {settings.smtp_host}:{settings.smtp_port}. "
            "If you're behind a firewall, try port 465 with SMTP_SECURE=true, "
            f"or use CONSOLE_EMAIL=true for development. Original error: {exc}"
        ) from exc

    logger.info("Email sent to %s | subject: %s", to_addrs, subject)
