import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.jira_job import JiraJobCreate, JiraJobOut
from app.schemas.jira_job_log import JiraJobLogOut
from app.services import jira_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jira", tags=["jira"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/jobs", response_model=JiraJobOut, status_code=202)
async def create_jira_job(
    body: JiraJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    job = await jira_service.create_job(db, body)
    # Commit NOW to release row locks on jira_jobs + projects before the
    # background task starts.  BackgroundTasks run inside the same AsyncExitStack
    # that owns get_db, so without this explicit commit the task deadlocks trying
    # to UPDATE the same rows the route handler session still holds locked.
    await db.commit()
    jira_service._dispatched.add(job.id)
    background_tasks.add_task(jira_service.process_job, job.id)
    logger.info("create_jira_job: dispatched %s (project=%s)", job.id, job.project_id)
    return JiraJobOut.from_orm_job(job)


@router.get("/jobs/{job_id}", response_model=JiraJobOut)
async def get_jira_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await jira_service.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JiraJobOut.from_orm_job(job)


@router.get("/jobs/{job_id}/logs", response_model=list[JiraJobLogOut])
async def get_jira_job_logs(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return ordered log entries for a specific job."""
    logs = await jira_service.get_job_logs(db, job_id)
    return [JiraJobLogOut.from_orm_log(log) for log in logs]


@router.post("/projects/{project_id}/retry-job", response_model=JiraJobOut, status_code=202)
async def retry_jira_job(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Reset the latest failed/pending job for a project and re-queue it.

    The background task resumes from the last committed checkpoint (story_key /
    subtask_keys), so Jira issues already created are not duplicated.
    """
    job = await jira_service.retry_job(db, project_id)
    if not job:
        raise HTTPException(status_code=404, detail="No retryable job found for this project")
    # Commit NOW — same deadlock reason as create_jira_job above.
    await db.commit()
    # Pre-claim the job in _dispatched before background_tasks fires to close
    # the race window where the background monitor could double-dispatch.
    jira_service._dispatched.add(job.id)
    background_tasks.add_task(jira_service.process_job, job.id)
    logger.info("retry_jira_job: dispatched %s (project=%s)", job.id, project_id)
    return JiraJobOut.from_orm_job(job)


# ─── Operation job endpoints ──────────────────────────────────────────────────

class OperationJobCreate(BaseModel):
    selected_subtask_keys: list[str]
    summary: str = "Change Request"


@router.post("/projects/{project_id}/operation-jobs", response_model=JiraJobOut, status_code=202)
async def create_operation_job(
    project_id: str,
    body: OperationJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Queue a Change Request subtask creation job for a project."""
    config = {
        "type": "operation",
        "selected_subtask_keys": body.selected_subtask_keys,
        "summary": body.summary,
    }
    job_data = JiraJobCreate(project_id=project_id, config=config)
    # update_project_status=False — operation jobs must not clobber the
    # migration job's "completed" status on the project row.
    job = await jira_service.create_job(db, job_data, update_project_status=False)
    await db.commit()
    jira_service._dispatched.add(job.id)
    background_tasks.add_task(jira_service.process_job, job.id)
    logger.info("create_operation_job: dispatched %s (project=%s)", job.id, project_id)
    return JiraJobOut.from_orm_job(job)


@router.get("/projects/{project_id}/operation-jobs", response_model=list[JiraJobOut])
async def list_operation_jobs(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all operation jobs for a project, newest first."""
    jobs = await jira_service.get_operation_jobs(db, project_id)
    return [JiraJobOut.from_orm_job(j) for j in jobs]


# ─── Admin endpoints ──────────────────────────────────────────────────────────

class AdminJiraJobRow(JiraJobOut):
    project_name: str
    logs: list[JiraJobLogOut] = []


@admin_router.get("/jira-jobs", response_model=list[AdminJiraJobRow])
async def admin_list_jira_jobs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return all jira jobs with project name and log entries (admin only)."""
    rows = await jira_service.get_all_jobs_with_projects(db)
    result = []
    for row in rows:
        job_out = JiraJobOut.from_orm_job(row["job"])
        result.append(
            AdminJiraJobRow(
                **job_out.model_dump(),
                project_name=row["project_name"],
                logs=[JiraJobLogOut.from_orm_log(log) for log in row["logs"]],
            )
        )
    return result
