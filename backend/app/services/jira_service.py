import random
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.cloud_resource import CloudResource
from app.models.jira_job import JiraJob
from app.models.project import Project
from app.schemas.jira_job import JiraJobCreate


async def create_job(session: AsyncSession, data: JiraJobCreate) -> JiraJob:
    job = JiraJob(
        id=f"jira-job-{uuid.uuid4().hex[:12]}",
        project_id=data.project_id,
        status="pending",
        config=data.config,
    )
    session.add(job)
    await session.flush()
    await session.refresh(job)
    return job


async def get_job(session: AsyncSession, job_id: str) -> JiraJob | None:
    return await session.get(JiraJob, job_id)


async def reset_stale_jobs(session: AsyncSession) -> None:
    """Called on startup to reset any jobs stuck in 'processing' state."""
    result = await session.execute(
        select(JiraJob).where(JiraJob.status == "processing")
    )
    for job in result.scalars().all():
        job.status = "failed"
    await session.flush()


async def process_job(job_id: str) -> None:
    """
    Background task: mirrors the mock jiraJobs.ts async flow.
    Creates its own session since it runs outside the request lifecycle.
    """
    async with AsyncSessionLocal() as session:
        try:
            job = await session.get(JiraJob, job_id)
            if not job:
                return

            job.status = "processing"
            project = await session.get(Project, job.project_id)
            if project:
                project.jira_job_status = "processing"
            await session.commit()

            # Simulate processing delay (non-blocking in real deployment via Celery)
            # For synchronous seed/test runs we complete immediately
            await _complete_job(session, job, project)
            await session.commit()

        except Exception:
            async with AsyncSessionLocal() as err_session:
                err_job = await err_session.get(JiraJob, job_id)
                if err_job:
                    err_job.status = "failed"
                    project = await err_session.get(Project, err_job.project_id)
                    if project:
                        project.jira_job_status = "failed"
                await err_session.commit()


async def _complete_job(
    session: AsyncSession, job: JiraJob, project: Project | None
) -> None:
    config = job.config or {}
    mode = config.get("mode", "resource-level")

    project_key = "MIG"
    if project and project.jira_ticket:
        project_key = project.jira_ticket.split("-")[0]

    story_num = random.randint(100, 999)
    story_key = f"{project_key}-{story_num}"
    counter = story_num + 1
    subtask_keys: dict[str, str] = {}

    # Load in-scope resources
    result = await session.execute(
        select(CloudResource)
        .where(CloudResource.project_id == job.project_id, CloudResource.need_migration.is_(True))
    )
    in_scope = list(result.scalars().all())

    if mode == "category-level":
        # Map product → category
        from app.services.product_category_service import get_category_for_product
        categories = list({get_category_for_product(r.product) for r in in_scope})
        for cat in categories:
            subtask_keys[cat] = f"{project_key}-{counter}"
            counter += 1
        for r in in_scope:
            cat = get_category_for_product(r.product)
            r.jira_subtask_key = subtask_keys.get(cat)

    elif mode == "product-level":
        products = list({r.product or "Other" for r in in_scope})
        for prod in products:
            subtask_keys[prod] = f"{project_key}-{counter}"
            counter += 1
        for r in in_scope:
            r.jira_subtask_key = subtask_keys.get(r.product or "Other")

    else:
        # resource-level or custom
        selected_ids = config.get("selectedResourceIds") or [r.id for r in in_scope]
        for rid in selected_ids:
            subtask_keys[rid] = f"{project_key}-{counter}"
            counter += 1
        for r in in_scope:
            if r.id in subtask_keys:
                r.jira_subtask_key = subtask_keys[r.id]

    job.story_key = story_key
    job.subtask_keys = subtask_keys
    job.status = "completed"
    job.processed_at = datetime.now(timezone.utc)

    if project:
        project.jira_story_key = story_key
        project.jira_job_status = "completed"
