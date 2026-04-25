from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.approval import ApprovalOut
from app.schemas.audit_log import AuditLogEntryOut, AuditLogResponse
from app.schemas.cloud_resource import CloudResourceOut, ResourceSpecsBatchUpdate
from app.schemas.project import (
    PlanningPatch,
    ProjectCreate,
    ProjectDetail,
    ProjectListItem,
    ProjectPatch,
    SectionPatch,
)
from app.schemas.user import UserOut
from app.schemas.risk import RiskOut
from app.services import audit_service, jira_client, project_service, user_service
from app.config import settings
from app.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/projects", tags=["projects"])


def _user_to_actor(user: User) -> dict[str, Any]:
    return {"id": user.id, "name": user.name, "initials": user.initials}


def _team_from_project_users(p) -> list[dict]:
    return [
        {"id": pu.user.id, "name": pu.user.name, "initials": pu.user.initials}
        for pu in (p.project_users or [])
        if pu.user is not None
    ]


def _project_list_item(p) -> ProjectListItem:
    return ProjectListItem(
        id=p.id,
        name=p.name,
        status=p.status,
        progress=p.progress,
        description=p.description,
        migration_wave=p.migration_wave,
        profile_owner=p.profile_owner,
        jira_ticket=p.jira_ticket,
        jira_base_url=settings.jira_base_url,
        last_updated=p.last_updated,
        wave_id=p.wave_id,
        jira_story_key=p.jira_story_key,
        jira_job_status=p.jira_job_status,
        planning=p.planning,
        team=_team_from_project_users(p),
        migration_constraints=p.migration_constraints,
        approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
        cloud_resources=[CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])],
    )


def _project_detail(p) -> ProjectDetail:
    return ProjectDetail(
        id=p.id,
        name=p.name,
        status=p.status,
        progress=p.progress,
        description=p.description,
        migration_wave=p.migration_wave,
        profile_owner=p.profile_owner,
        jira_ticket=p.jira_ticket,
        jira_base_url=settings.jira_base_url,
        last_updated=p.last_updated,
        wave_id=p.wave_id,
        jira_story_key=p.jira_story_key,
        jira_job_status=p.jira_job_status,
        planning=p.planning,
        jira_subtask_config=p.jira_subtask_config,
        team=_team_from_project_users(p),
        application_overview=p.application_overview,
        availability=p.availability,
        data_persistence=p.data_persistence,
        dependencies=p.dependencies,
        nfrs=p.nfrs,
        migration_constraints=p.migration_constraints,
        target_architecture=p.target_architecture,
        cloud_resources=[CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])],
        risks=[RiskOut.model_validate(r) for r in (p.risks or [])],
        approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
    )


@router.get("", response_model=list[ProjectListItem])
async def list_projects(
    userId: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    projects = await project_service.get_all(db, user_id=userId)
    return [_project_list_item(p) for p in projects]


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = await project_service.create(db, body)
    return _project_detail(project)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_detail(project)


@router.get("/{project_id}/users", response_model=list[UserOut])
async def get_project_users(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await user_service.get_users_for_project(db, project_id)


@router.patch("/{project_id}", response_model=ProjectDetail)
async def update_project(
    project_id: str,
    body: ProjectPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    actor = _user_to_actor(current_user)
    try:
        project = await project_service.update(db, project, body, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _project_detail(project)


@router.patch("/{project_id}/sections/{section_key}", response_model=ProjectDetail)
async def update_section(
    project_id: str,
    section_key: str,
    body: SectionPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if section_key not in project_service.SECTION_COLUMN_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown section key: {section_key}")
    actor = _user_to_actor(current_user)
    try:
        project = await project_service.update_section(db, project, section_key, body.value, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _project_detail(project)


@router.get("/{project_id}/audit-log", response_model=AuditLogResponse)
async def get_project_audit_log(project_id: str, db: AsyncSession = Depends(get_db)):
    entries = await audit_service.get_by_project(db, project_id)
    return AuditLogResponse(
        entries=[AuditLogEntryOut.from_orm_entry(e) for e in entries],
        total=len(entries),
    )


@router.post("/{project_id}/resources/specs", status_code=204)
async def batch_update_resource_specs(
    project_id: str,
    body: ResourceSpecsBatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    actor = _user_to_actor(current_user)
    await project_service.batch_update_resource_specs(db, project_id, body.updates, actor)


@router.patch("/{project_id}/planning", response_model=ProjectDetail)
async def update_planning(
    project_id: str,
    body: PlanningPatch,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project = await project_service.update_planning(db, project, body.planning)
    # Best-effort Jira story date sync if a story exists
    if project.jira_story_key:
        story_key = project.jira_story_key
        start = body.planning.get("startDate")
        end = body.planning.get("endDate")
        background_tasks.add_task(jira_client.update_issue_dates, story_key, start, end)
    return _project_detail(project)
