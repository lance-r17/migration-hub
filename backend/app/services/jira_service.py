import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import AsyncSessionLocal
from app.models.cloud_resource import CloudResource
from app.models.jira_job import JiraJob
from app.models.jira_job_log import JiraJobLog
from app.models.project import Project
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

async def create_job(session: AsyncSession, data: JiraJobCreate) -> JiraJob:
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
        "create_job: created %s (project=%s wave_epic_key=%r mode=%r)",
        job.id, job.project_id, job.wave_epic_key,
        (data.config or {}).get("mode", "resource-level"),
    )

    # Set project status to "pending" immediately so the frontend banner appears
    # on the next refreshProject() call (before the background task even starts).
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
        if job.story_key:
            # Progress was made in Jira — resume from last checkpoint
            job.status = "pending"
            if project:
                project.jira_job_status = "pending"
            job_ids_to_resume.append(job.id)
            logger.info("reset_stale_jobs: resuming %s (story_key=%s)", job.id, job.story_key)
            await _log_event(session, job.id, "info", "Job resumed from checkpoint on startup")
        else:
            # Nothing created in Jira — safe to fail; user can retry
            job.status = "failed"
            if project:
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
    if project:
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
                project = await session.get(Project, job.project_id)
                if project:
                    project.jira_job_status = "processing"
                await _log_event(session, job_id, "info", "Job started processing")
                await session.commit()
                logger.info("process_job processing: %s (project=%s)", job_id, job.project_id)

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
                            if err_project:
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

    # Build buckets NOW while in_scope objects are freshly loaded (before any commits).
    # Bucket keys are plain strings so they survive session expiry across commits.
    if mode == "category-level":
        from app.services.product_category_service import get_category_for_product
        buckets: dict[str, str] = {}
        for r in in_scope:
            cat = get_category_for_product(r.product)
            buckets.setdefault(cat, cat)
    elif mode == "product-level":
        buckets = {}
        for r in in_scope:
            prod = r.product or "Other"
            buckets.setdefault(prod, prod)
    else:
        # resource-level or custom: bucket_key = resource ID, display = resource name
        selected_ids = config.get("selectedResourceIds") or [r.id for r in in_scope]
        id_to_name = {r.id: r.name for r in in_scope}
        buckets = {rid: id_to_name.get(rid, rid) for rid in selected_ids}

    logger.info("_complete_job: %d bucket(s) built (mode=%s)", len(buckets), mode)

    # ── Phase 1: Create story (C1) ────────────────────────────────────────────
    # in_scope objects become expired after this commit — buckets dict above is
    # the only thing we need from them going forward until Phase 3 re-queries.
    if not job.story_key:
        logger.info("_complete_job C1: creating story (use_real_jira=%s)", use_real_jira)
        if use_real_jira:
            story_key = await jira_client.create_story(
                project_key=project_key,
                summary=f"Migration: {project.name if project else project_key}",
                parent_epic_key=job.wave_epic_key,  # type: ignore[arg-type]
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
            sk = await jira_client.create_subtask(
                project_key=project_key,
                summary=bucket_name,
                parent_story_key=story_key,
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
            if r.id in (job.subtask_keys or {}):
                r.jira_subtask_key = job.subtask_keys[r.id]

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
