from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.jira_job import JiraJobCreate, JiraJobOut
from app.services import jira_service

router = APIRouter(prefix="/jira", tags=["jira"])


@router.post("/jobs", response_model=JiraJobOut, status_code=202)
async def create_jira_job(
    body: JiraJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    job = await jira_service.create_job(db, body)
    background_tasks.add_task(jira_service.process_job, job.id)
    return JiraJobOut.from_orm_job(job)


@router.get("/jobs/{job_id}", response_model=JiraJobOut)
async def get_jira_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await jira_service.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JiraJobOut.from_orm_job(job)
