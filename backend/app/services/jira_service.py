import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.database import AsyncSessionLocal
from app.models.cloud_resource import CloudResource
from app.models.jira_job import JiraJob
from app.models.jira_job_log import JiraJobLog
from app.models.project import Project
from app.models.risk import Risk
from app.models.wave import Wave
from app.schemas.jira_job import JiraJobCreate

# In-memory set of job IDs currently dispatched/running.
# Prevents the background monitor from double-dispatching a job that is
# already being processed.  Valid for single-process (single-worker) deployment.
_dispatched: set[str] = set()


# ─── Internal helpers ─────────────────────────────────────────────────────────

async def _log_event(
    session: AsyncSession,
    job_id: str,
    level: str,
    message: str,
    **meta: Any,
) -> None:
    """Append a log entry for a job within the given session (flush only; caller commits)."""
    entry = JiraJobLog(
        id=f"jl-{uuid.uuid4().hex[:12]}",
        job_id=job_id,
        level=level,
        message=message,
        meta=dict(meta) if meta else None,
    )
    session.add(entry)
    await session.flush()


# ─── Public service functions ─────────────────────────────────────────────────

async def create_job(
    session: AsyncSession,
    data: JiraJobCreate,
    update_project_status: bool = True,
) -> JiraJob:
    job = JiraJob(
        id=f"jira-job-{uuid.uuid4().hex[:12]}",
        project_id=data.project_id,
        status="pending",
        config=data.config,
        wave_epic_key=data.wave_epic_key,
    )
    session.add(job)
    await session.flush()
    await session.refresh(job)
    logger.info(
        "create_job: created %s (project=%s wave_epic_key=%r type=%r)",
        job.id, job.project_id, job.wave_epic_key,
        (data.config or {}).get("type", "migration"),
    )

    # Set project status to "pending" immediately so the frontend banner appears
    # on the next refreshProject() call (before the background task even starts).
    # Operation jobs must NOT update this field — it tracks the migration job only.
    if update_project_status:
        project = await session.get(Project, data.project_id)
        if project:
            project.jira_job_status = "pending"
            await session.flush()

    return job


async def get_job(session: AsyncSession, job_id: str) -> JiraJob | None:
    return await session.get(JiraJob, job_id)


async def get_job_logs(session: AsyncSession, job_id: str) -> list[JiraJobLog]:
    result = await session.execute(
        select(JiraJobLog)
        .where(JiraJobLog.job_id == job_id)
        .order_by(JiraJobLog.timestamp)
    )
    return list(result.scalars().all())


async def get_all_jobs_with_projects(session: AsyncSession) -> list[dict]:
    """Return all jobs joined with their project name (admin view)."""
    result = await session.execute(
        select(JiraJob, Project.name.label("project_name"))
        .join(Project, JiraJob.project_id == Project.id)
        .order_by(JiraJob.requested_at.desc())
    )
    rows = []
    for job, project_name in result.all():
        logs_result = await session.execute(
            select(JiraJobLog)
            .where(JiraJobLog.job_id == job.id)
            .order_by(JiraJobLog.timestamp)
        )
        rows.append({"job": job, "project_name": project_name, "logs": list(logs_result.scalars().all())})
    return rows


async def get_operation_jobs(session: AsyncSession, project_id: str) -> list[JiraJob]:
    """Return all operation jobs for a project, newest first."""
    result = await session.execute(
        select(JiraJob)
        .where(
            JiraJob.project_id == project_id,
            JiraJob.config["type"].astext == "operation",
        )
        .order_by(JiraJob.requested_at.desc())
    )
    return list(result.scalars().all())


async def reset_stale_jobs(session: AsyncSession) -> list[str]:
    """Called on startup to handle jobs stuck in 'processing' state.

    Jobs that already created a Jira story (story_key is set) are reset to
    'pending' so they can resume from the last checkpoint.  Jobs that haven't
    created anything yet are marked 'failed' — safe to restart fresh.

    Returns the IDs of jobs that should be resumed (caller schedules them).
    """
    result = await session.execute(
        select(JiraJob).where(JiraJob.status == "processing")
    )
    job_ids_to_resume: list[str] = []
    for job in result.scalars().all():
        project = await session.get(Project, job.project_id)
        job_type = (job.config or {}).get("type", "migration")
        if job.story_key:
            # Progress was made in Jira — resume from last checkpoint
            job.status = "pending"
            if project and job_type == "migration":
                project.jira_job_status = "pending"
            job_ids_to_resume.append(job.id)
            logger.info("reset_stale_jobs: resuming %s (story_key=%s)", job.id, job.story_key)
            await _log_event(session, job.id, "info", "Job resumed from checkpoint on startup")
        else:
            # Nothing created in Jira — safe to fail; user can retry
            job.status = "failed"
            if project and job_type == "migration":
                project.jira_job_status = "failed"
            logger.warning("reset_stale_jobs: marking failed (no Jira progress): %s", job.id)
            await _log_event(
                session, job.id, "warning",
                "Job marked failed on startup (no progress in Jira)",
            )
    await session.flush()
    return job_ids_to_resume


async def dispatch_pending_jobs(session: AsyncSession) -> list[str]:
    """Query all pending jobs and schedule those not already dispatched.

    Logs a 'picked up' entry for each newly dispatched job and flushes within
    the provided session — caller is responsible for committing.

    Returns the list of newly dispatched job IDs.
    """
    result = await session.execute(
        select(JiraJob).where(JiraJob.status == "pending")
    )
    pending = result.scalars().all()
    dispatched: list[str] = []
    for job in pending:
        if job.id in _dispatched:
            logger.debug("dispatch_pending_jobs: skipping %s (already in-flight)", job.id)
            continue
        await _log_event(session, job.id, "info", "Job picked up by background monitor")
        asyncio.create_task(process_job(job.id))
        dispatched.append(job.id)
    if dispatched:
        logger.info("dispatch_pending_jobs: dispatched %d job(s): %s", len(dispatched), dispatched)
    else:
        logger.debug(
            "dispatch_pending_jobs: nothing to dispatch (pending=%d in-flight=%d)",
            len(pending), len(_dispatched),
        )
    return dispatched


async def start_pending_job_monitor(poll_interval_seconds: int = 30) -> None:
    """Periodic background monitor: sweep for pending jobs every interval.

    Sleeps first so the startup pass in lifespan() runs immediately without
    waiting for the first tick.  Cancel the returned task to stop the monitor.
    """
    tick = 0
    try:
        while True:
            await asyncio.sleep(poll_interval_seconds)
            tick += 1
            logger.debug("pending_job_monitor: tick #%d", tick)
            async with AsyncSessionLocal() as session:
                dispatched = await dispatch_pending_jobs(session)
                if dispatched:
                    await session.commit()
    except asyncio.CancelledError:
        logger.info("pending_job_monitor: cancelled after %d tick(s)", tick)
        raise


async def retry_job(session: AsyncSession, project_id: str) -> JiraJob | None:
    """Find the latest failed/pending job for a project and reset it to 'pending'."""
    result = await session.execute(
        select(JiraJob)
        .where(JiraJob.project_id == project_id, JiraJob.status.in_(["failed", "pending"]))
        .order_by(JiraJob.requested_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        logger.info("retry_job: no retryable job found for project %s", project_id)
        return None
    logger.info("retry_job: resetting %s (was %r) for project %s", job.id, job.status, project_id)
    job.status = "pending"
    project = await session.get(Project, project_id)
    # Operation jobs must not clobber project.jira_job_status — that field tracks the migration job only.
    if project and (job.config or {}).get("type", "migration") == "migration":
        project.jira_job_status = "pending"
    await _log_event(session, job.id, "info", "Job retried by user")
    await session.flush()
    return job


async def process_job(job_id: str) -> None:
    """
    Background task: mirrors the mock jiraJobs.ts async flow.
    Creates its own session since it runs outside the request lifecycle.
    """
    logger.info("process_job started: %s", job_id)
    _dispatched.add(job_id)
    try:
        async with AsyncSessionLocal() as session:
            try:
                job = await session.get(JiraJob, job_id)
                if not job:
                    logger.warning("process_job: job not found in DB: %s", job_id)
                    return

                job.status = "processing"
                result = await session.execute(
                    select(Project).where(Project.id == job.project_id).options(selectinload(Project.profile_owner_user))
                )
                project = result.scalar_one_or_none()
                job_type = (job.config or {}).get("type", "migration")
                # Only migration jobs should update project.jira_job_status.
                if job_type == "migration" and project:
                    project.jira_job_status = "processing"
                await _log_event(session, job_id, "info", "Job started processing")
                await session.commit()
                logger.info("process_job processing: %s (project=%s)", job_id, job.project_id)
                if job_type == "operation":
                    await _complete_operation_job(session, job, project)
                elif job_type == "sync-complete":
                    await _complete_sync_complete_job(session, job, project)
                else:
                    await _complete_job(session, job, project)
                await session.commit()
                logger.info("process_job completed: %s", job_id)

            except Exception as exc:
                logger.exception(
                    "process_job failed: %s — %s: %s", job_id, type(exc).__name__, exc
                )
                try:
                    async with AsyncSessionLocal() as err_session:
                        err_job = await err_session.get(JiraJob, job_id)
                        if err_job:
                            err_job.status = "failed"
                            err_project = await err_session.get(Project, err_job.project_id)
                            if err_project and (err_job.config or {}).get("type", "migration") == "migration":
                                err_project.jira_job_status = "failed"
                            await _log_event(
                                err_session, job_id, "error",
                                f"Job failed: {type(exc).__name__}: {exc}",
                            )
                            await err_session.commit()
                            logger.info("process_job: marked %s as failed in DB", job_id)
                        else:
                            logger.warning(
                                "process_job: job %s not found in DB during error recovery", job_id
                            )
                except Exception as recovery_exc:
                    logger.error(
                        "process_job: error recovery failed for %s: %s", job_id, recovery_exc
                    )
    finally:
        _dispatched.discard(job_id)
        logger.info("process_job: cleared from _dispatched: %s", job_id)


# ─── ADF description helpers ──────────────────────────────────────────────────

def _adf_text(text: str) -> dict:
    return {"type": "text", "text": str(text)}


def _adf_paragraph(text: str) -> dict:
    return {"type": "paragraph", "content": [_adf_text(text)]}


def _adf_heading(text: str, level: int = 2) -> dict:
    return {"type": "heading", "attrs": {"level": level}, "content": [_adf_text(text)]}


def _adf_rule() -> dict:
    return {"type": "rule"}


def _adf_bullet_list(items: list[str]) -> dict:
    return {
        "type": "bulletList",
        "content": [
            {"type": "listItem", "content": [_adf_paragraph(item)]}
            for item in items
        ],
    }


def _adf_kv_table(rows: list[tuple[str, Any]]) -> dict:
    def _cell(text: str, header: bool = False) -> dict:
        return {
            "type": "tableHeader" if header else "tableCell",
            "attrs": {},
            "content": [_adf_paragraph(str(text) if text is not None else "—")],
        }

    header_row = {"type": "tableRow", "content": [_cell("Field", True), _cell("Value", True)]}
    body_rows = [
        {"type": "tableRow", "content": [_cell(k), _cell(str(v) if v not in (None, "", []) else "—")]}
        for k, v in rows
    ]
    return {
        "type": "table",
        "attrs": {"isNumberColumnEnabled": False, "layout": "default"},
        "content": [header_row, *body_rows],
    }


def _adf_resource_table(headers: list[str], rows: list[list[str]]) -> dict:
    def _cell(text: str, header: bool = False) -> dict:
        return {
            "type": "tableHeader" if header else "tableCell",
            "attrs": {},
            "content": [_adf_paragraph(str(text) if text else "—")],
        }

    return {
        "type": "table",
        "attrs": {"isNumberColumnEnabled": False, "layout": "default"},
        "content": [
            {"type": "tableRow", "content": [_cell(h, True) for h in headers]},
            *[{"type": "tableRow", "content": [_cell(v) for v in row]} for row in rows],
        ],
    }


def _build_story_description(
    project: "Project",
    resources: list,
    wave: "Wave | None",
    risks: list,
) -> dict:
    """Build a full ADF document for the migration story."""
    ao = project.application_overview or {}
    mc = project.migration_constraints or {}
    av = project.availability or {}
    deps = project.dependencies or {}
    content: list[dict] = []

    # ── Migration Overview ────────────────────────────────────────────────────
    content.append(_adf_heading("Migration Overview"))
    preferred_window = ", ".join(mc.get("preferredMigrationWindow") or []) or None
    snow_groups = ", ".join(mc.get("snowCiGroups") or []) or None
    content.append(_adf_kv_table([
        ("Wave", wave.name if wave else None),
        ("Cutover Date", wave.cutover_date if wave else None),
        ("Start Date", wave.start_date if wave else None),
        ("Migration Strategy", ao.get("migrationStrategy")),
        ("Application Tier", ao.get("applicationTier")),
        ("BA ID", ao.get("baId")),
        ("System Importance Classification", ", ".join(ao.get("systemImportanceClassification") or []) or None),
        ("IITA Applicability", ("Yes" if ao.get("iitaApplicability") else "No") if ao.get("iitaApplicability") is not None else None),
        ("Software Origin", ao.get("softwareOrigin")),
        ("Profile Owner", project.profile_owner_user.name if project.profile_owner_user else None),
        ("Status", project.status),
    ]))
    content.append(_adf_rule())

    # ── Migration Constraints ─────────────────────────────────────────────────
    content.append(_adf_heading("Migration Constraints"))
    content.append(_adf_kv_table([
        ("Migration Window", mc.get("regularMigrationWindow")),
        ("Preferred Window", preferred_window),
        ("Earliest Start", mc.get("earliestStartDate")),
        ("Latest End", mc.get("latestEndDate")),
        ("CR Duration (hrs)", str(mc["crDurationHours"]) if mc.get("crDurationHours") is not None else None),
        ("SNOW CI Groups", snow_groups),
    ]))
    content.append(_adf_rule())

    # ── Availability ──────────────────────────────────────────────────────────
    content.append(_adf_heading("Availability"))
    content.append(_adf_kv_table([
        ("RTO", av.get("rto")),
        ("RPO", av.get("rpo")),
    ]))
    content.append(_adf_rule())

    # ── Resources In Scope ────────────────────────────────────────────────────
    content.append(_adf_heading(f"Resources In Scope ({len(resources)})"))
    product_counts: dict[str, int] = {}
    for r in resources:
        key = r.product or "Unknown"
        product_counts[key] = product_counts.get(key, 0) + 1
    scope_lines = [f"{prod}: {cnt} resource{'s' if cnt > 1 else ''}" for prod, cnt in sorted(product_counts.items())]
    scope_lines.append(f"Total: {len(resources)}")
    content.append(_adf_bullet_list(scope_lines))

    # ── Open Risks ────────────────────────────────────────────────────────────
    open_risks = [r for r in risks if r.risk_status != "resolved"]
    if open_risks:
        content.append(_adf_rule())
        content.append(_adf_heading(f"Open Risks ({len(open_risks)})"))
        content.append(_adf_bullet_list([f"[{r.severity.upper()}] {r.title}" for r in open_risks]))

    # ── Dependencies ─────────────────────────────────────────────────────────
    dep_items: list[str] = []
    for d in (deps.get("upstream") or []):
        name = d.get("name") or d.get("baId", "")
        if name:
            dep_items.append(f"Upstream: {name}")
    for d in (deps.get("downstream") or []):
        name = d.get("name") or d.get("baId", "")
        if name:
            dep_items.append(f"Downstream: {name}")
    if dep_items:
        content.append(_adf_rule())
        content.append(_adf_heading("Dependencies"))
        content.append(_adf_bullet_list(dep_items))

    return {"version": 1, "type": "doc", "content": content}


def _build_subtask_description(
    bucket_key: str,
    bucket_name: str,
    resources: list,
    project: "Project",
    wave: "Wave | None",
) -> dict:
    """Build a full ADF document for a resource subtask."""
    mc = project.migration_constraints or {}
    snow_groups = ", ".join(mc.get("snowCiGroups") or []) or None
    content: list[dict] = []

    # ── Resource Details ──────────────────────────────────────────────────────
    if len(resources) == 1:
        r = resources[0]
        content.append(_adf_heading("Resource Details"))
        content.append(_adf_kv_table([
            ("Name", r.name),
            ("Source ID", r.resource_id),
            ("Target ID", r.target_resource_id),
            ("Product", r.product),
            ("Resource Set", r.resource_set),
            ("Sub Application", r.sub_application),
        ]))
        if r.specs:
            content.append(_adf_heading("Specs", level=3))
            content.append(_adf_kv_table(list(r.specs.items())))
    else:
        content.append(_adf_heading(f"Resources ({len(resources)})"))
        rows = [
            [r.name, r.product or "", r.resource_id or "", r.target_resource_id or ""]
            for r in resources
        ]
        content.append(_adf_resource_table(["Name", "Product", "Source ID", "Target ID"], rows))

    # ── Migration Context ─────────────────────────────────────────────────────
    content.append(_adf_rule())
    content.append(_adf_heading("Migration Context"))
    content.append(_adf_kv_table([
        ("Wave", wave.name if wave else None),
        ("Cutover Date", wave.cutover_date if wave else None),
        ("CR Duration (hrs)", str(mc["crDurationHours"]) if mc.get("crDurationHours") is not None else None),
        ("SNOW CI Groups", snow_groups),
        ("Migration Window", mc.get("regularMigrationWindow")),
    ]))

    return {"version": 1, "type": "doc", "content": content}


def _build_cr_description(
    project: "Project",
    wave: "Wave | None",
    linked_resources: list,
) -> dict:
    """Build a full ADF document for a CR/Operation subtask."""
    mc = project.migration_constraints or {}
    snow_groups = ", ".join(mc.get("snowCiGroups") or []) or None
    preferred_window = ", ".join(mc.get("preferredMigrationWindow") or []) or None
    content: list[dict] = []

    # ── Change Request Context ────────────────────────────────────────────────
    content.append(_adf_heading("Change Request Context"))
    content.append(_adf_kv_table([
        ("Wave", wave.name if wave else None),
        ("Cutover Date", wave.cutover_date if wave else None),
        ("CR Duration (hrs)", str(mc["crDurationHours"]) if mc.get("crDurationHours") is not None else None),
        ("SNOW CI Groups", snow_groups),
        ("Migration Window", mc.get("regularMigrationWindow")),
        ("Preferred Window", preferred_window),
    ]))

    # ── Affected Resources ────────────────────────────────────────────────────
    if linked_resources:
        content.append(_adf_rule())
        content.append(_adf_heading(f"Affected Resources ({len(linked_resources)})"))
        rows = [
            [r.name, r.product or "", r.resource_id or "", r.jira_subtask_key or ""]
            for r in linked_resources
        ]
        content.append(_adf_resource_table(["Name", "Product", "Source ID", "Subtask Key"], rows))

    # ── Change Freeze Periods ─────────────────────────────────────────────────
    freeze_periods = mc.get("changeFreezePeriods") or []
    if freeze_periods:
        content.append(_adf_rule())
        content.append(_adf_heading("Change Freeze Periods"))
        freeze_items = [
            f"{fp['name']} ({fp.get('from', '')} → {fp.get('to', '')})"
            if isinstance(fp, dict) else str(fp)
            for fp in freeze_periods
        ]
        content.append(_adf_bullet_list(freeze_items))

    return {"version": 1, "type": "doc", "content": content}


async def _complete_job(
    session: AsyncSession, job: JiraJob, project: Project | None
) -> None:
    """
    Process a jira job in three checkpointed phases.

    Checkpoints (each committed immediately to DB):
      C1 — job.story_key set after story creation
      C2 — job.subtask_keys[bucket] set after each subtask creation
      C3 — job.status = "completed" (done by process_job caller commit)

    On retry, completed checkpoints are detected and skipped, preventing
    duplicate Jira issues and allowing safe resume after any failure.
    """
    from app.config import settings
    from app.services import jira_client

    logger.info("_complete_job enter: job_id=%s project_id=%s", job.id, job.project_id)

    config = job.config or {}
    mode = config.get("mode", "resource-level")

    project_key = "MIG"
    if job.wave_epic_key:
        project_key = job.wave_epic_key.split("-")[0]
    elif project and project.jira_ticket:
        project_key = project.jira_ticket.split("-")[0]

    logger.info("_complete_job config: mode=%s project_key=%s", mode, project_key)

    # Real Jira requires both a configured base URL and a parent epic key
    use_real_jira = bool(settings.jira_base_url and job.wave_epic_key)
    logger.info(
        "_complete_job use_real_jira=%s jira_base_url=%r wave_epic_key=%r",
        use_real_jira, bool(settings.jira_base_url), job.wave_epic_key,
    )

    # Load in-scope resources
    logger.info("_complete_job: querying cloud resources for project %s", job.project_id)
    result = await session.execute(
        select(CloudResource)
        .where(CloudResource.project_id == job.project_id, CloudResource.need_migration.is_(True))
    )
    in_scope = list(result.scalars().all())
    logger.info("_complete_job: %d in-scope resource(s)", len(in_scope))

    # Load wave and risks for description building (before any commits while session is fresh)
    wave: Wave | None = None
    if project and project.wave_id:
        wave = await session.get(Wave, project.wave_id)
        logger.info("_complete_job: wave=%s", wave.name if wave else "None")
    risks: list[Risk] = []
    if project:
        risks_result = await session.execute(select(Risk).where(Risk.project_id == job.project_id))
        risks = list(risks_result.scalars().all())
    logger.info("_complete_job: %d risk(s) loaded", len(risks))

    # Build buckets NOW while in_scope objects are freshly loaded (before any commits).
    # Bucket keys are plain strings so they survive session expiry across commits.
    # bucket_resources maps bucket_key → list of CloudResource for description building.
    bucket_resources: dict[str, list] = {}
    if mode == "category-level":
        from app.services.product_category_service import get_category_for_product
        buckets: dict[str, str] = {}
        for r in in_scope:
            cat = get_category_for_product(r.product)
            buckets.setdefault(cat, cat)
            bucket_resources.setdefault(cat, []).append(r)
    elif mode == "product-level":
        buckets = {}
        for r in in_scope:
            prod = r.product or "Other"
            buckets.setdefault(prod, prod)
            bucket_resources.setdefault(prod, []).append(r)
    else:
        # resource-level or custom: bucket_key = resource ID, display = resource name
        selected_ids = config.get("selectedResourceIds") or [r.resource_id for r in in_scope]
        id_to_name = {r.resource_id: r.name for r in in_scope}
        id_to_resource = {r.resource_id: r for r in in_scope}
        buckets = {rid: id_to_name.get(rid, rid) for rid in selected_ids}
        bucket_resources = {rid: [id_to_resource[rid]] for rid in selected_ids if rid in id_to_resource}

    logger.info("_complete_job: %d bucket(s) built (mode=%s)", len(buckets), mode)

    # ── Phase 1: Create story (C1) ────────────────────────────────────────────
    # in_scope objects become expired after this commit — buckets dict above is
    # the only thing we need from them going forward until Phase 3 re-queries.
    if not job.story_key:
        logger.info("_complete_job C1: creating story (use_real_jira=%s)", use_real_jira)
        if use_real_jira:
            story_desc = _build_story_description(project, in_scope, wave, risks) if project else None
            story_key = await jira_client.create_story(
                project_key=project_key,
                summary=f"Migration: {project.name if project else project_key}",
                parent_epic_key=job.wave_epic_key,  # type: ignore[arg-type]
                description=story_desc,
            )
        else:
            story_num = random.randint(100, 999)
            story_key = f"{project_key}-{story_num}"

        job.story_key = story_key
        if project:
            project.jira_story_key = story_key  # persist story key to project at C1
        await _log_event(session, job.id, "info", f"Story created: {story_key}")
        await session.commit()   # C1 persisted — safe to resume here on crash
        await session.refresh(job)
        logger.info("_complete_job C1 done: story_key=%s", story_key)
    else:
        story_key = job.story_key  # Resume: story already created
        logger.info("_complete_job C1 skipped: story_key=%s already set", story_key)
        if project and not project.jira_story_key:
            project.jira_story_key = story_key
            await session.flush()
            logger.info("_complete_job C1 backfill: set project.jira_story_key=%s", story_key)

    # ── Phase 2: Create subtasks per bucket (C2) ──────────────────────────────
    # Uses only the plain-string buckets dict — no SQLAlchemy object access needed.
    base_num = int(story_key.split("-")[1])

    for bucket_key, bucket_name in buckets.items():
        if bucket_key in (job.subtask_keys or {}):
            logger.info("_complete_job C2 skipped: bucket %r already has subtask", bucket_key)
            continue  # C2 already persisted for this bucket — skip

        logger.info("_complete_job C2: creating subtask for bucket %r (use_real_jira=%s)", bucket_key, use_real_jira)
        if use_real_jira:
            subtask_resources = bucket_resources.get(bucket_key, [])
            subtask_desc = _build_subtask_description(bucket_key, bucket_name, subtask_resources, project, wave) if project else None
            sk = await jira_client.create_subtask(
                project_key=project_key,
                summary=bucket_name,
                parent_story_key=story_key,
                description=subtask_desc,
            )
        else:
            sk = f"{project_key}-{base_num + 1 + len(job.subtask_keys or {})}"

        updated = {**(job.subtask_keys or {}), bucket_key: sk}
        job.subtask_keys = updated
        flag_modified(job, "subtask_keys")
        await _log_event(
            session, job.id, "info",
            f"Subtask created: {sk} for bucket '{bucket_name}'",
        )
        await session.commit()   # C2 persisted per bucket
        await session.refresh(job)
        logger.info("_complete_job C2 done: subtask_key=%s bucket=%r", sk, bucket_key)

    # ── Phase 3: Update resource records and mark complete (C3) ───────────────
    # Re-query in_scope fresh — earlier commits expired the original references.
    # Assignments are idempotent (safe to re-run on retry).
    logger.info("_complete_job C3: updating resource subtask keys and marking complete")
    result2 = await session.execute(
        select(CloudResource)
        .where(CloudResource.project_id == job.project_id, CloudResource.need_migration.is_(True))
    )
    in_scope_fresh = list(result2.scalars().all())
    logger.info("_complete_job C3: %d resource(s) to update", len(in_scope_fresh))

    if mode == "category-level":
        from app.services.product_category_service import get_category_for_product
        for r in in_scope_fresh:
            r.jira_subtask_key = job.subtask_keys.get(get_category_for_product(r.product))
    elif mode == "product-level":
        for r in in_scope_fresh:
            r.jira_subtask_key = job.subtask_keys.get(r.product or "Other")
    else:
        for r in in_scope_fresh:
            if r.resource_id in (job.subtask_keys or {}):
                r.jira_subtask_key = job.subtask_keys[r.resource_id]

    job.status = "completed"
    job.processed_at = datetime.now(timezone.utc)

    if project:
        project.jira_job_status = "completed"

    n_subtasks = len(job.subtask_keys or {})
    await _log_event(
        session, job.id, "info",
        f"Job completed: {story_key}, {n_subtasks} subtask(s)",
    )
    logger.info("_complete_job C3 done: job=%s story=%s subtasks=%d", job.id, story_key, n_subtasks)
    # Final commit is done by process_job() after this function returns


async def _complete_operation_job(
    session: AsyncSession, job: JiraJob, project: Project | None
) -> None:
    """
    Process an operation job: create a Change Request subtask and link it to
    selected resource subtasks via the configured issue link type.

    Checkpoint:
      C1 — job.subtask_keys["cr"] set after CR subtask creation (idempotent on retry)

    Mock mode (no jira_base_url or no project.jira_story_key): generates a fake
    CR key but skips issue link creation — provides usable dev flow.
    """
    from app.config import settings
    from app.services import jira_client

    config = job.config or {}
    selected_subtask_keys: list[str] = config.get("selected_subtask_keys", [])
    summary: str = config.get("summary", "Change Request")

    logger.info(
        "_complete_operation_job enter: job_id=%s project_id=%s summary=%r selected=%s",
        job.id, job.project_id, summary, selected_subtask_keys,
    )

    use_real_jira = bool(settings.jira_base_url and project and project.jira_story_key)
    logger.info("_complete_operation_job use_real_jira=%s", use_real_jira)

    if project and project.jira_story_key:
        project_key = project.jira_story_key.split("-")[0]
    else:
        project_key = settings.jira_project_key

    # Load wave and linked resources for description building
    wave: Wave | None = None
    if project and project.wave_id:
        wave = await session.get(Wave, project.wave_id)
    linked_resources: list[CloudResource] = []
    if selected_subtask_keys and project:
        lr_result = await session.execute(
            select(CloudResource).where(
                CloudResource.project_id == job.project_id,
                CloudResource.jira_subtask_key.in_(selected_subtask_keys),
            )
        )
        linked_resources = list(lr_result.scalars().all())
        logger.info(
            "_complete_operation_job: %d linked resource(s) for %d selected key(s)",
            len(linked_resources), len(selected_subtask_keys),
        )

    # ── C1: Create the Change Request subtask (idempotent) ────────────────────
    existing_keys = job.subtask_keys or {}
    if "cr" not in existing_keys:
        logger.info("_complete_operation_job C1: creating CR subtask (use_real_jira=%s)", use_real_jira)
        if use_real_jira:
            cr_desc = _build_cr_description(project, wave, linked_resources) if project else None
            cr_key = await jira_client.create_subtask(
                project_key=project_key,
                summary=summary,
                parent_story_key=project.jira_story_key,  # type: ignore[union-attr]
                description=cr_desc,
            )
        else:
            cr_key = f"{project_key}-{random.randint(200, 999)}"

        job.subtask_keys = {**existing_keys, "cr": cr_key}
        flag_modified(job, "subtask_keys")
        await _log_event(session, job.id, "info", f"CR subtask created: {cr_key}")
        await session.commit()
        await session.refresh(job)
        logger.info("_complete_operation_job C1 done: cr_key=%s", cr_key)
    else:
        cr_key = existing_keys["cr"]
        logger.info("_complete_operation_job C1 skipped: cr_key=%s already set", cr_key)

    # ── Create issue links (real Jira only) ───────────────────────────────────
    if use_real_jira and selected_subtask_keys:
        link_type = settings.jira_issue_link_type
        for target_key in selected_subtask_keys:
            logger.info(
                "_complete_operation_job link: %s %s %s", cr_key, link_type, target_key
            )
            await jira_client.create_issue_link(target_key, cr_key, link_type)
            await _log_event(
                session, job.id, "info",
                f"Linked: {cr_key} {link_type} {target_key}",
            )

    # ── Mark complete ─────────────────────────────────────────────────────────
    job.status = "completed"
    job.processed_at = datetime.now(timezone.utc)

    await _log_event(
        session, job.id, "info",
        f"Operation job completed: {cr_key}, linked to {len(selected_subtask_keys)} subtask(s)",
    )
    logger.info(
        "_complete_operation_job done: job=%s cr_key=%s links=%d",
        job.id, cr_key, len(selected_subtask_keys),
    )
    # Final commit is done by process_job() after this function returns


async def _complete_sync_complete_job(
    session: AsyncSession, job: JiraJob, project: Project | None
) -> None:
    """
    Process a sync-complete job: transition a resource's Jira subtask to Done
    and mark the resource as migration_completed locally.

    Checkpoint:
      C1 — job.status set to "completed" after subtask transition + DB update.
    """
    from app.config import settings
    from app.services import jira_client
    from app.models.cloud_resource import CloudResource

    config = job.config or {}
    resource_id: str = config.get("resource_id", "")
    subtask_key: str = config.get("subtask_key", "")
    actor_name: str = config.get("actor_name", "")
    actor_email: str = config.get("actor_email", "")
    if actor_name and actor_email:
        comment_text = f"Synchronization is confirmed by user - {actor_name} ({actor_email})"
    elif actor_name:
        comment_text = f"Synchronization is confirmed by user - {actor_name}"
    else:
        comment_text = "Synchronization confirmed"

    logger.info(
        "_complete_sync_complete_job enter: job_id=%s resource_id=%s subtask_key=%s",
        job.id, resource_id, subtask_key,
    )

    use_real_jira = bool(settings.jira_base_url and subtask_key)
    logger.info("_complete_sync_complete_job use_real_jira=%s", use_real_jira)

    # ── C1: Transition subtask to Done and add comment (real Jira only) ───────
    if use_real_jira:
        try:
            transitions = await jira_client.get_transitions(subtask_key)
            transition_id = jira_client.get_done_transition_id(transitions)
            if transition_id:
                await jira_client.transition_issue(subtask_key, transition_id)
                await _log_event(
                    session, job.id, "info",
                    f"Subtask transitioned to Done: {subtask_key}",
                )
                logger.info(
                    "_complete_sync_complete_job: transitioned %s to Done",
                    subtask_key,
                )
            else:
                logger.warning(
                    "_complete_sync_complete_job: no Done transition found for %s",
                    subtask_key,
                )
                await _log_event(
                    session, job.id, "warning",
                    f"No Done transition found for subtask {subtask_key}",
                )
        except Exception as exc:
            logger.exception(
                "_complete_sync_complete_job: failed to transition %s: %s",
                subtask_key, exc,
            )
            await _log_event(
                session, job.id, "error",
                f"Failed to transition subtask {subtask_key}: {exc}",
            )
            raise

        # Add comment independently of transition so it appears even if the
        # subtask was already in Done status.
        try:
            await jira_client.add_comment(subtask_key, comment_text)
            await _log_event(
                session, job.id, "info",
                f"Comment added to subtask {subtask_key}",
            )
            logger.info(
                "_complete_sync_complete_job: comment added to %s",
                subtask_key,
            )
        except Exception as exc:
            logger.warning(
                "_complete_sync_complete_job: failed to add comment to %s: %s",
                subtask_key, exc,
            )
            await _log_event(
                session, job.id, "warning",
                f"Failed to add comment to subtask {subtask_key}: {exc}",
            )

    # ── Update resource migration_completed ───────────────────────────────────
    if resource_id:
        resource = await session.get(CloudResource, resource_id)
        if resource:
            resource.migration_completed = True
            await _log_event(
                session, job.id, "info",
                f"Resource marked migration completed: {resource.name or resource_id}",
            )
            logger.info(
                "_complete_sync_complete_job: resource %s migration_completed=True",
                resource_id,
            )
        else:
            logger.warning(
                "_complete_sync_complete_job: resource %s not found", resource_id
            )

    # ── Mark job complete ─────────────────────────────────────────────────────
    job.status = "completed"
    job.processed_at = datetime.now(timezone.utc)

    await _log_event(
        session, job.id, "info",
        f"Sync-complete job finished: subtask={subtask_key}",
    )
    logger.info(
        "_complete_sync_complete_job done: job=%s subtask=%s",
        job.id, subtask_key,
    )
    # Final commit is done by process_job() after this function returns
