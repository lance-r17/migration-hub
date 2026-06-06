import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.email_template import EmailTemplate
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.wave import Wave
from app.config import settings
from app.services.email_event_config_service import get_email_event_config, get_last_run, set_last_run
from app.services.email_service import enqueue_email, render_snapshot

logger = logging.getLogger(__name__)


async def _resolve_recipients(
    session: AsyncSession,
    project: Project,
    recipient_list: list[dict[str, str]],
) -> list[str]:
    """Resolve role-based and custom email recipients to concrete addresses."""
    emails: set[str] = set()

    # Direct / static email addresses (any non-role entry with an email field)
    for r in recipient_list:
        if r.get("type") != "role" and r.get("email"):
            emails.add(r["email"])

    # Role-based recipients
    role_specs = [r for r in recipient_list if r.get("type") == "role"]
    if role_specs:
        # Ensure project_users are loaded
        if not hasattr(project, "project_users") or project.project_users is None:
            result = await session.execute(
                select(ProjectUser)
                .where(ProjectUser.project_id == project.id)
                .options(selectinload(ProjectUser.user))
            )
            project.project_users = list(result.scalars().all())

        target_roles = {r["role"] for r in role_specs}
        for pu in project.project_users:
            if pu.user and pu.role:
                roles = {r.strip() for r in pu.role.split(",") if r.strip()}
                if roles & target_roles:
                    emails.add(pu.user.email)

    return sorted(emails)


async def scan_and_enqueue(session: AsyncSession) -> list[str]:
    """Scan waves for upcoming cutovers and enqueue reminder emails.

    Returns the list of newly enqueued EmailJob IDs.
    """
    config = await get_email_event_config(session)
    cutover_cfg = config.get("cutover_reminder", {})
    if not cutover_cfg.get("enabled", True):
        logger.info("cutover_reminder: disabled")
        return []

    reminder_days: list[int] = cutover_cfg.get("reminder_days", [7, 3, 1])
    if not reminder_days:
        return []

    today = date.today()
    target_dates = {today + timedelta(days=d) for d in reminder_days}

    # Load cutover reminder template
    template_result = await session.execute(
        select(EmailTemplate).where(EmailTemplate.event_type == "cutover_reminder")
    )
    template: EmailTemplate | None = template_result.scalar_one_or_none()
    if not template:
        logger.warning("cutover_reminder: no template found for event_type=cutover_reminder")
        return []
    if not template.html_snapshot:
        logger.warning("cutover_reminder: template %s has no html_snapshot", template.id)
        return []

    # Find waves with cutover_date matching any target date
    wave_result = await session.execute(
        select(Wave)
        .where(Wave.cutover_date.in_([d.isoformat() for d in target_dates]))
        .where(Wave.deleted == False)  # noqa: E712
    )
    waves = list(wave_result.scalars().all())
    if not waves:
        logger.debug("cutover_reminder: no waves with cutover in %s", target_dates)
        return []

    enqueued: list[str] = []
    for wave in waves:
        # Load projects for this wave with users
        project_result = await session.execute(
            select(Project)
            .where(Project.wave_id == wave.id)
            .options(selectinload(Project.project_users).selectinload(ProjectUser.user))
        )
        projects = list(project_result.scalars().all())
        if not projects:
            continue

        cutover_dt = date.fromisoformat(wave.cutover_date)
        days_until = (cutover_dt - today).days

        for project in projects:
            to_addrs = await _resolve_recipients(session, project, template.recipient_list)
            if not to_addrs:
                logger.info(
                    "cutover_reminder: no recipients for project %s wave %s",
                    project.id,
                    wave.id,
                )
                continue

            idempotency_key = f"cutover-reminder-{wave.id}-{project.id}-{wave.cutover_date}"

            context = {
                "wave": {"name": wave.name, "cutoverDate": wave.cutover_date},
                "project": {"name": project.name, "id": project.id},
                "daysUntilCutover": days_until,
                "user": {"name": ""},
                "platform": {"name": settings.platform_name, "url": settings.platform_url},
                "jiraBaseUrl": settings.jira_base_url,
                "jiraStoryKey": project.jira_story_key or "",
            }

            subject = render_snapshot(html_snapshot=template.subject, context=context)
            html_body = render_snapshot(html_snapshot=template.html_snapshot, context=context)

            job = await enqueue_email(
                session,
                event_type="cutover_reminder",
                template_id=template.id,
                to_addrs=to_addrs,
                subject=subject,
                html_body=html_body,
                context=context,
                idempotency_key=idempotency_key,
            )
            if job.status == "pending":
                enqueued.append(job.id)
                logger.info(
                    "cutover_reminder: enqueued %s for project %s wave %s days=%d",
                    job.id,
                    project.id,
                    wave.id,
                    days_until,
                )

    return enqueued


async def start_cutover_reminder_monitor(poll_interval_seconds: int = 300) -> None:
    """Periodic monitor: once per day at configured UTC time, scan waves and enqueue reminders.

    Sleeps first so startup doesn't double-run if lifespan triggers a manual sweep.
    """
    tick = 0
    try:
        while True:
            await asyncio.sleep(poll_interval_seconds)
            tick += 1
            logger.debug("cutover_reminder_monitor: tick #%d", tick)

            async with AsyncSessionLocal() as session:
                config = await get_email_event_config(session)
                cutover_cfg = config.get("cutover_reminder", {})
                run_time = cutover_cfg.get("run_time_utc", "09:00")

                now = datetime.now(timezone.utc)
                last_run = await get_last_run(session)

                # Simple daily gate: if we have already run today at or after run_time, skip
                run_hour, run_minute = map(int, run_time.split(":"))
                today_run_time = now.replace(hour=run_hour, minute=run_minute, second=0, microsecond=0)

                if last_run and last_run.date() >= now.date() and last_run >= today_run_time:
                    logger.debug("cutover_reminder_monitor: already ran today")
                    continue

                if now < today_run_time:
                    logger.debug("cutover_reminder_monitor: before run_time %s", run_time)
                    continue

                enqueued = await scan_and_enqueue(session)
                if enqueued:
                    await session.commit()
                    logger.info(
                        "cutover_reminder_monitor: enqueued %d job(s)", len(enqueued)
                    )
                else:
                    await session.commit()  # commit config read even if nothing enqueued

                await set_last_run(session, now)
                await session.commit()
    except asyncio.CancelledError:
        logger.info("cutover_reminder_monitor: cancelled after %d tick(s)", tick)
        raise
