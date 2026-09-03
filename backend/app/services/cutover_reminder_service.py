import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.email_job import EmailJob
from app.models.email_template import EmailTemplate
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.wave import Wave
from app.config import settings
from app.services.email_event_config_service import get_email_event_config, get_last_run, set_last_run
from app.services.email_service import enqueue_email, render_snapshot

logger = logging.getLogger(__name__)


_RECIPIENT_ROLE_LABELS = {
    "platform_migration_lead": "Platform Migration Lead",
    "technical_lead": "Technical Lead",
    "business_owner": "Business Owner",
    "gbi_champion": "BGI Champion",
    "gbi_champion_delegate": "BGI Champion Delegate",
    "itso": "ITSO",
    "itso_delegate": "ITSO Delegate",
    "dba_data_owner": "DBA Data Owner",
}


async def _resolve_recipients_detailed(
    session: AsyncSession,
    project: Project,
    recipient_list: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Resolve role-based and custom recipients to [{email, badge}].

    badge is the matched role label(s), or "Custom" for static addresses.
    """
    detailed: dict[str, str] = {}  # email -> badge

    # Direct / static email addresses (any non-role entry with an email field)
    for r in recipient_list:
        if r.get("type") != "role" and r.get("email"):
            detailed.setdefault(r["email"], "Custom")

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
                matched = roles & target_roles
                if matched:
                    badge = ", ".join(
                        sorted(_RECIPIENT_ROLE_LABELS.get(r, r) for r in matched)
                    )
                    detailed.setdefault(pu.user.email, badge)

    return [{"email": e, "badge": b} for e, b in sorted(detailed.items())]


async def _resolve_recipients(
    session: AsyncSession,
    project: Project,
    recipient_list: list[dict[str, str]],
) -> list[str]:
    """Resolve role-based and custom email recipients to concrete addresses."""
    return [
        r["email"]
        for r in await _resolve_recipients_detailed(session, project, recipient_list)
    ]


async def scan_cutover_reminders(
    session: AsyncSession,
    *,
    respect_enabled: bool = True,
    exact_days: bool = True,
) -> list[dict]:
    """Find wave/project pairs matching the cutover reminder window, without enqueueing.

    With exact_days=True (daily monitor), only waves whose cutover is exactly
    one of the configured reminder days match. With exact_days=False (manual
    scan), any future cutover within max(reminder_days) days matches.

    Each match dict contains both public display fields and internal fields
    (context, html_snapshot, template_id) needed by enqueue_cutover_reminders.
    """
    config = await get_email_event_config(session)
    cutover_cfg = config.get("cutover_reminder", {})
    if respect_enabled and not cutover_cfg.get("enabled", True):
        logger.info("cutover_reminder: disabled")
        return []

    reminder_days: list[int] = cutover_cfg.get("reminder_days", [7, 3, 1])
    if not reminder_days:
        return []

    today = date.today()

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

    # Find waves with cutover_date matching the reminder window
    wave_query = select(Wave).where(Wave.deleted == False)  # noqa: E712
    if exact_days:
        target_dates = {today + timedelta(days=d) for d in reminder_days}
        wave_query = wave_query.where(
            Wave.cutover_date.in_([d.isoformat() for d in target_dates])
        )
    else:
        max_day = max(reminder_days)
        wave_query = wave_query.where(
            Wave.cutover_date >= today.isoformat(),
            Wave.cutover_date <= (today + timedelta(days=max_day)).isoformat(),
        )
    waves = list((await session.execute(wave_query)).scalars().all())
    if not waves:
        logger.debug("cutover_reminder: no waves matching reminder window")
        return []

    matches: list[dict] = []
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
            recipients = await _resolve_recipients_detailed(session, project, template.recipient_list)
            to_addrs = [r["email"] for r in recipients]
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

            existing = await session.scalar(
                select(EmailJob).where(EmailJob.idempotency_key == idempotency_key)
            )

            matches.append({
                "wave_id": wave.id,
                "wave_name": wave.name,
                "cutover_date": wave.cutover_date,
                "days_until": days_until,
                "project_id": project.id,
                "project_name": project.name,
                "to_addrs": to_addrs,
                "recipients": recipients,
                "subject": render_snapshot(html_snapshot=template.subject, context=context),
                "already_enqueued": existing is not None,
                # internal fields for enqueueing
                "context": context,
                "html_snapshot": template.html_snapshot,
                "template_id": template.id,
                "idempotency_key": idempotency_key,
            })

    return matches


async def enqueue_cutover_reminders(
    session: AsyncSession,
    matches: list[dict],
) -> list[str]:
    """Enqueue email jobs for the given scan matches. Caller is responsible for commit."""
    enqueued: list[str] = []
    for m in matches:
        job = await enqueue_email(
            session,
            event_type="cutover_reminder",
            template_id=m["template_id"],
            to_addrs=m["to_addrs"],
            subject=m["subject"],
            html_body=render_snapshot(html_snapshot=m["html_snapshot"], context=m["context"]),
            context=m["context"],
            idempotency_key=m["idempotency_key"],
        )
        if job.status == "pending":
            enqueued.append(job.id)
            logger.info(
                "cutover_reminder: enqueued %s for project %s wave %s days=%d",
                job.id,
                m["project_id"],
                m["wave_id"],
                m["days_until"],
            )
    return enqueued


async def scan_and_enqueue(session: AsyncSession) -> list[str]:
    """Scan waves for upcoming cutovers and enqueue reminder emails.

    Returns the list of newly enqueued EmailJob IDs.
    """
    matches = await scan_cutover_reminders(session)
    return await enqueue_cutover_reminders(session, matches)


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
