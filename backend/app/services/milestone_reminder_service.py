import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.email_job import EmailJob
from app.models.email_template import EmailTemplate
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.wave import Wave
from app.services.cutover_reminder_service import _resolve_recipients_detailed
from app.services.email_event_config_service import (
    MILESTONE_LAST_RUN_KEY,
    get_email_event_config,
    get_last_run,
    set_last_run,
)
from app.services.email_service import enqueue_email, render_snapshot

logger = logging.getLogger(__name__)

_STATUS_LABELS = {"todo": "To Do", "in-progress": "In Progress", "done": "Completed"}


def _due_label(days_until: int) -> str:
    if days_until > 1:
        return f"in {days_until} days"
    if days_until == 1:
        return "in 1 day"
    if days_until == 0:
        return "due today"
    if days_until == -1:
        return "1 day overdue"
    return f"{-days_until} days overdue"


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _collect_milestones(project: Project, scopes: dict, today: date) -> list[dict]:
    """Collect a project's milestones (per enabled scopes) into a unified shape:
    {id, name, status, target_date} — only todo / in-progress milestones, where
    todo targets the start date and in-progress targets the end date.
    Mirrors the row logic of the wave Gantt chart.
    """
    planning = project.planning or {}
    collected: list[dict] = []

    assigned_cm_ids = {cm.id for cm in (project.category_milestones or [])}

    if scopes.get("planning", True):
        for m in planning.get("milestones") or []:
            if m.get("id") in assigned_cm_ids:
                continue  # shown as category milestone row instead
            status = m.get("status", "todo")
            target = m.get("start") if status == "todo" else m.get("end") if status == "in-progress" else None
            target_dt = _parse_date(target)
            if not target_dt:
                continue
            collected.append({
                "id": m.get("id"),
                "name": m.get("name") or "Milestone",
                "status": status,
                "target_date": target_dt,
            })

    if scopes.get("auto_derived", True):
        # env-provision: one single-day milestone per environment with a provision date
        provision = project.environment_provision or {}
        for env in ("dev", "prod"):
            entry = provision.get(env) or {}
            target_dt = _parse_date(entry.get("date"))
            if not target_dt:
                continue
            if entry.get("completed_at") or entry.get("completedAt"):
                status = "done"
            elif target_dt <= today:
                status = "in-progress"
            else:
                status = "todo"
            if status == "done":
                continue
            collected.append({
                "id": f"env-provision-date-{project.id}-{env}",
                "name": f"Environment Provision ({'Dev' if env == 'dev' else 'Prod'})",
                "status": status,
                "target_date": target_dt,
            })

        # data-migration period: union of plan/cycle-block dates
        plan = project.data_migration_plan or project.data_migration_schedule or {}
        candidates: list[dict] = []
        if plan.get("startDate"):
            candidates.append({"start": plan.get("startDate"), "end": plan.get("endDate")})
        for block in plan.get("cycleBlocks") or []:
            candidates.append({"start": block.get("startDate"), "end": block.get("endDate")})
        starts = [d for d in (_parse_date(c.get("start")) for c in candidates) if d]
        ends = [d for d in (_parse_date(c.get("end")) for c in candidates) if d]
        if starts and ends:
            start, end = min(starts), max(ends)
            if plan.get("completedAt"):
                status = "done"
            elif start <= today <= end:
                status = "in-progress"
            else:
                status = "todo"
            if status != "done":
                collected.append({
                    "id": f"data-migration-period-{project.id}",
                    "name": "Data Migration (Prod)",
                    "status": status,
                    "target_date": start if status == "todo" else end,
                })

    if scopes.get("category", False):
        overrides = planning.get("categoryMilestoneOverrides") or {}
        for cm in project.category_milestones or []:
            override = overrides.get(cm.id) or {}
            status = override.get("status", "todo")
            start_dt = _parse_date(override.get("start")) or _parse_date(cm.start_date)
            end_dt = _parse_date(override.get("end")) or _parse_date(cm.end_date)
            target_dt = start_dt if status == "todo" else end_dt if status == "in-progress" else None
            if not target_dt:
                continue
            collected.append({
                "id": f"category-milestone-{project.id}-{cm.id}",
                "name": cm.name,
                "status": status,
                "target_date": target_dt,
            })

    return collected


async def _last_sent_map(session: AsyncSession) -> dict[str, datetime]:
    """Latest created_at per 'milestone-reminder-{pid}-{mid}' idempotency prefix."""
    result = await session.execute(
        select(EmailJob.idempotency_key, EmailJob.created_at).where(
            EmailJob.idempotency_key.like("milestone-reminder-%")
        )
    )
    last: dict[str, datetime] = {}
    for key, created_at in result:
        if not key or not created_at:
            continue
        # strip the trailing -{date} segment to get the milestone prefix
        prefix = key.rsplit("-", 1)[0]
        if prefix not in last or created_at > last[prefix]:
            last[prefix] = created_at
    return last


async def scan_milestone_reminders(
    session: AsyncSession,
    *,
    respect_enabled: bool = True,
) -> list[dict]:
    """Find approaching/overdue milestones of projects in waves, without enqueueing.

    A milestone is due when it is within reminder_days of its target date
    (start for todo, end for in-progress) or overdue. Matches already sent
    within frequency_days are returned with on_cooldown=True.
    """
    config = await get_email_event_config(session)
    cfg = config.get("milestone_reminder", {})
    if respect_enabled and not cfg.get("enabled", True):
        logger.info("milestone_reminder: disabled")
        return []

    reminder_days = cfg.get("reminder_days", [7, 3, 1])
    if isinstance(reminder_days, int):
        reminder_days = [reminder_days]
    if not reminder_days:
        return []
    max_reminder_day = max(reminder_days)
    frequency_days: int = cfg.get("frequency_days", 3)
    scopes: dict = cfg.get("scopes") or {"planning": True, "auto_derived": True, "category": False}
    if not scopes.get("planning") and not scopes.get("auto_derived") and not scopes.get("category"):
        return []

    template_result = await session.execute(
        select(EmailTemplate).where(EmailTemplate.event_type == "milestone_reminder")
    )
    template: EmailTemplate | None = template_result.scalar_one_or_none()
    if not template:
        logger.warning("milestone_reminder: no template found for event_type=milestone_reminder")
        return []
    if not template.html_snapshot:
        logger.warning("milestone_reminder: template %s has no html_snapshot", template.id)
        return []

    project_result = await session.execute(
        select(Project)
        .where(Project.wave_id.isnot(None))
        .options(
            selectinload(Project.project_users).selectinload(ProjectUser.user),
            selectinload(Project.category_milestones),
        )
    )
    projects = list(project_result.scalars().all())
    if not projects:
        return []

    wave_result = await session.execute(select(Wave).where(Wave.deleted == False))  # noqa: E712
    wave_names = {w.id: w.name for w in wave_result.scalars().all()}

    today = date.today()
    now = datetime.now(timezone.utc)
    cooldown_before = now - timedelta(days=frequency_days)
    last_sent = await _last_sent_map(session)

    matches: list[dict] = []
    for project in projects:
        milestones = _collect_milestones(project, scopes, today)
        due = []
        for m in milestones:
            days_until = (m["target_date"] - today).days
            if days_until > max_reminder_day:
                continue
            prefix = f"milestone-reminder-{project.id}-{m['id']}"
            sent_at = last_sent.get(prefix)
            due.append({
                **m,
                "days_until": days_until,
                "idempotency_key": f"{prefix}-{today:%Y%m%d}",
                "on_cooldown": sent_at is not None and sent_at > cooldown_before,
                "last_sent_at": sent_at.isoformat() if sent_at else None,
            })
        if not due:
            continue

        recipients = await _resolve_recipients_detailed(session, project, template.recipient_list)
        to_addrs = [r["email"] for r in recipients]
        if not to_addrs:
            logger.info("milestone_reminder: no recipients for project %s", project.id)
            continue

        wave_name = wave_names.get(project.wave_id, "")
        for m in due:
            context = {
                "project": {"name": project.name, "id": project.id},
                "wave": {"name": wave_name},
                "milestone": {
                    "name": m["name"],
                    "status": m["status"],
                    "statusLabel": _STATUS_LABELS.get(m["status"], m["status"]),
                    "targetDate": m["target_date"].isoformat(),
                    "targetLabel": "start date" if m["status"] == "todo" else "end date",
                    "dueLabel": _due_label(m["days_until"]),
                },
                "daysUntil": m["days_until"],
                "user": {"name": ""},
                "platform": {"name": settings.platform_name, "url": settings.platform_url},
            }
            matches.append({
                "project_id": project.id,
                "project_name": project.name,
                "wave_id": project.wave_id,
                "wave_name": wave_name,
                "milestone_id": m["id"],
                "milestone_name": m["name"],
                "milestone_status": m["status"],
                "target_date": m["target_date"].isoformat(),
                "days_until": m["days_until"],
                "to_addrs": to_addrs,
                "recipients": recipients,
                "subject": render_snapshot(html_snapshot=template.subject, context=context),
                "on_cooldown": m["on_cooldown"],
                "last_sent_at": m["last_sent_at"],
                # internal fields for enqueueing
                "context": context,
                "html_snapshot": template.html_snapshot,
                "template_id": template.id,
                "idempotency_key": m["idempotency_key"],
            })

    return matches


async def enqueue_milestone_reminders(
    session: AsyncSession,
    matches: list[dict],
) -> list[str]:
    """Enqueue email jobs for the given scan matches. Caller is responsible for commit."""
    enqueued: list[str] = []
    for m in matches:
        if m.get("on_cooldown") or not m.get("to_addrs"):
            continue
        job = await enqueue_email(
            session,
            event_type="milestone_reminder",
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
                "milestone_reminder: enqueued %s for project %s milestone %s",
                job.id,
                m["project_id"],
                m["milestone_id"],
            )
    return enqueued


async def scan_and_enqueue_milestones(session: AsyncSession) -> list[str]:
    """Scan for due milestone reminders and enqueue them (daily monitor path)."""
    matches = await scan_milestone_reminders(session)
    return await enqueue_milestone_reminders(session, matches)


async def start_milestone_reminder_monitor(poll_interval_seconds: int = 300) -> None:
    """Periodic monitor: once per day at configured UTC time, scan milestones and enqueue reminders."""
    tick = 0
    try:
        while True:
            await asyncio.sleep(poll_interval_seconds)
            tick += 1
            logger.debug("milestone_reminder_monitor: tick #%d", tick)

            async with AsyncSessionLocal() as session:
                config = await get_email_event_config(session)
                cfg = config.get("milestone_reminder", {})
                run_time = cfg.get("run_time_utc", "09:00")

                now = datetime.now(timezone.utc)
                last_run = await get_last_run(session, MILESTONE_LAST_RUN_KEY)

                run_hour, run_minute = map(int, run_time.split(":"))
                today_run_time = now.replace(hour=run_hour, minute=run_minute, second=0, microsecond=0)

                if last_run and last_run.date() >= now.date() and last_run >= today_run_time:
                    logger.debug("milestone_reminder_monitor: already ran today")
                    continue

                if now < today_run_time:
                    logger.debug("milestone_reminder_monitor: before run_time %s", run_time)
                    continue

                enqueued = await scan_and_enqueue_milestones(session)
                if enqueued:
                    await session.commit()
                    logger.info(
                        "milestone_reminder_monitor: enqueued %d job(s)", len(enqueued)
                    )
                else:
                    await session.commit()

                await set_last_run(session, now, MILESTONE_LAST_RUN_KEY)
                await session.commit()
    except asyncio.CancelledError:
        logger.info("milestone_reminder_monitor: cancelled after %d tick(s)", tick)
        raise
