from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.approval import ApprovalOut
from app.schemas.audit_log import AuditLogEntryOut, AuditLogResponse
from app.schemas.cloud_resource import (
    CloudResourceOut,
    ResourceSpecsBatchUpdate,
    ResourcesBatchDelete,
    ResourcesBatchUpsert,
)
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
from app.schemas.jira_job import JiraJobCreate
from app.services import audit_service, attachment_service, jira_client, jira_service, project_service, user_service
from app.config import settings
from app.auth import get_current_user
from app.models.user import User
from app.models.cloud_resource import CloudResource
from app.models.project_attachment import ProjectAttachment
from app.schemas.project_attachment import AttachmentOut

router = APIRouter(prefix="/projects", tags=["projects"])


def _user_to_actor(user: User) -> dict[str, Any]:
    actor: dict[str, Any] = {"id": user.id, "name": user.name, "initials": user.initials}
    if user.is_service_account:
        actor["type"] = "service_account"
    return actor


def _team_from_project_users(p) -> list[dict]:
    return [
        {"id": pu.user.id, "name": pu.user.name, "initials": pu.user.initials}
        for pu in (p.project_users or [])
        if pu.user is not None
    ]


def _derive_status(p, stage_data: dict) -> str:
    if p.status == "blocked":
        return "blocked"
    return project_service.derive_status_from_stage_progress(stage_data)


def _project_list_item(p) -> ProjectListItem:
    stage_data = project_service.compute_stage_progress(p)
    return ProjectListItem(
        id=p.id,
        name=p.name,
        status=_derive_status(p, stage_data),
        progress=stage_data["overall"],
        description=p.description,
        migration_wave=p.migration_wave,
        profile_owner=p.profile_owner_user.name if p.profile_owner_user else None,
        jira_ticket=p.jira_ticket,
        jira_base_url=settings.jira_base_url,
        updated_at=p.updated_at.strftime("%d %b %Y").upper() if p.updated_at else None,
        wave_id=p.wave_id,
        jira_story_key=p.jira_story_key,
        jira_job_status=p.jira_job_status,
        planning=p.planning,
        survey_submitted_at=p.survey_submitted_at,
        stage_progress={k: v for k, v in stage_data.items() if k != "overall"},
        team=_team_from_project_users(p),
        migration_constraints=p.migration_constraints,
        approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
        cloud_resources=[CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])],
    )


def _project_detail(p) -> ProjectDetail:
    stage_data = project_service.compute_stage_progress(p)
    return ProjectDetail(
        id=p.id,
        name=p.name,
        status=_derive_status(p, stage_data),
        progress=stage_data["overall"],
        description=p.description,
        migration_wave=p.migration_wave,
        profile_owner=p.profile_owner_user.name if p.profile_owner_user else None,
        jira_ticket=p.jira_ticket,
        jira_base_url=settings.jira_base_url,
        updated_at=p.updated_at.strftime("%d %b %Y").upper() if p.updated_at else None,
        wave_id=p.wave_id,
        jira_story_key=p.jira_story_key,
        jira_job_status=p.jira_job_status,
        planning=p.planning,
        survey_submitted_at=p.survey_submitted_at,
        stage_progress={k: v for k, v in stage_data.items() if k != "overall"},
        jira_subtask_config=p.jira_subtask_config,
        team=_team_from_project_users(p),
        migration_effort_estimation=p.migration_effort_estimation,
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
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actor = _user_to_actor(current_user)
    project = await project_service.create(db, body, actor)
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


def _require_platform_lead_for_block(user: User) -> None:
    if "platform_migration_lead" not in (user.role or ""):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads can block or unblock projects.",
        )


def _resolve_status_if_unblocking(project, new_status: str) -> str:
    """If unblocking, derive the correct status from stage progress."""
    if project.status == "blocked" and new_status != "blocked":
        stage_data = project_service.compute_stage_progress(project)
        return project_service.derive_status_from_stage_progress(stage_data)
    return new_status


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

    patch_data = body.model_dump(exclude_none=True)
    if "status" in patch_data:
        old_status = project.status
        new_status = patch_data["status"]
        if old_status == "blocked" or new_status == "blocked":
            _require_platform_lead_for_block(current_user)
            patch_data["status"] = _resolve_status_if_unblocking(project, new_status)
        body = ProjectPatch(**patch_data)

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

    value = body.value
    if section_key == "status":
        old_status = project.status
        new_status = value
        if old_status == "blocked" or new_status == "blocked":
            _require_platform_lead_for_block(current_user)
            value = _resolve_status_if_unblocking(project, new_status)

    actor = _user_to_actor(current_user)
    try:
        project = await project_service.update_section(db, project, section_key, value, actor)
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


@router.patch("/{project_id}/resources", response_model=ProjectDetail)
async def upsert_project_resources(
    project_id: str,
    body: ResourcesBatchUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    actor = _user_to_actor(current_user)
    await project_service.upsert_resources(db, project, body.resources, actor)
    await db.refresh(project)
    return _project_detail(project)


@router.delete("/{project_id}/resources", response_model=ProjectDetail)
async def delete_project_resources(
    project_id: str,
    body: ResourcesBatchDelete,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    actor = _user_to_actor(current_user)
    await project_service.delete_resources_by_ids(db, project, body.resource_ids, actor)
    await db.refresh(project)
    return _project_detail(project)


@router.post("/{project_id}/resources/{resource_id}/sync-complete", response_model=ProjectDetail, status_code=202)
async def mark_resource_sync_complete(
    project_id: str,
    resource_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a resource's sync as completed and queue a Jira job to close its subtask."""
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    resource = await db.get(CloudResource, resource_id)
    if not resource or resource.project_id != project_id:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Update sync status
    old_sync_status = resource.sync_status
    resource.sync_status = "synced"
    await db.flush()

    await audit_service.append_entry(
        db,
        project_id=project_id,
        event_type="resource_sync_completed",
        entity_type="resource",
        actor=_user_to_actor(current_user),
        entity_id=resource_id,
        entity_label=resource.name,
        changes=[{
            "field": "syncStatus",
            "label": "Sync Status",
            "old_value": old_sync_status,
            "new_value": "synced",
        }],
    )

    # Queue Jira job if a subtask exists; otherwise mark migration completed immediately
    if resource.jira_subtask_key:
        job_data = JiraJobCreate(
            project_id=project_id,
            config={
                "type": "sync-complete",
                "resource_id": resource_id,
                "subtask_key": resource.jira_subtask_key,
                "actor_name": current_user.name,
                "actor_email": current_user.email,
            },
        )
        job = await jira_service.create_job(db, job_data, update_project_status=False)
        await db.commit()
        jira_service._dispatched.add(job.id)
        background_tasks.add_task(jira_service.process_job, job.id)
    else:
        resource.migration_completed = True

    # Derive status from latest stage progress
    await project_service._derive_and_store_status(db, project)
    await db.flush()
    await db.refresh(project)
    return _project_detail(project)


@router.post("/{project_id}/survey-submitted", response_model=ProjectDetail)
async def mark_survey_submitted(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.survey_submitted_at = datetime.now(timezone.utc)
    await audit_service.append_entry(
        db,
        project_id=project_id,
        event_type="survey_submitted",
        entity_type="project",
        actor=_user_to_actor(current_user),
    )
    await project_service._derive_and_store_status(db, project)
    await db.flush()
    await db.refresh(project)
    return _project_detail(project)


@router.patch("/{project_id}/planning", response_model=ProjectDetail)
async def update_planning(
    project_id: str,
    body: PlanningPatch,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    actor = _user_to_actor(current_user)
    project = await project_service.update_planning(db, project, body.planning, actor)
    # Best-effort Jira story date sync if a story exists
    if project.jira_story_key:
        story_key = project.jira_story_key
        start = body.planning.get("startDate")
        end = body.planning.get("endDate")
        background_tasks.add_task(jira_client.update_issue_dates, story_key, start, end)
    return _project_detail(project)


# ─── Project Attachments ──────────────────────────────────────────────────────

import os
import uuid
from fastapi.responses import FileResponse
from sqlalchemy import select

_UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "projects")


def _ensure_upload_dir(project_id: str) -> str:
    path = os.path.join(_UPLOAD_DIR, project_id)
    os.makedirs(path, exist_ok=True)
    return path


@router.post("/{project_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    project_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    safe_filename = os.path.basename(file.filename or "unnamed")
    attachment_id = str(uuid.uuid4())
    storage_filename = f"{attachment_id}_{safe_filename}"
    project_dir = _ensure_upload_dir(project_id)
    file_path = os.path.join(project_dir, storage_filename)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    attachment = ProjectAttachment(
        id=attachment_id,
        project_id=project_id,
        filename=safe_filename,
        file_path=file_path,
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)

    await audit_service.append_entry(
        db,
        project_id=project_id,
        event_type="attachment_uploaded",
        entity_type="attachment",
        actor=_user_to_actor(current_user),
        entity_id=attachment_id,
        entity_label=safe_filename,
    )
    await db.flush()

    return AttachmentOut(
        id=attachment.id,
        project_id=attachment.project_id,
        filename=attachment.filename,
        file_path=attachment.file_path,
        status=attachment.status,
        created_at=attachment.created_at.isoformat() if attachment.created_at else None,
    )


@router.get("/{project_id}/attachments", response_model=list[AttachmentOut])
async def list_attachments(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ProjectAttachment)
        .where(
            ProjectAttachment.project_id == project_id,
            ProjectAttachment.status != attachment_service.STATUS_DELETED,
        )
        .order_by(ProjectAttachment.created_at.desc())
    )
    attachments = result.scalars().all()
    return [
        AttachmentOut(
            id=a.id,
            project_id=a.project_id,
            filename=a.filename,
            file_path=a.file_path,
            status=a.status,
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in attachments
    ]


@router.get("/{project_id}/attachments/{attachment_id}")
async def download_attachment(
    project_id: str,
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    attachment = await db.get(ProjectAttachment, attachment_id)
    if not attachment or attachment.project_id != project_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        attachment.file_path,
        filename=attachment.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{project_id}/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    project_id: str,
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    attachment = await attachment_service.soft_delete_attachment(
        db, project_id, attachment_id
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await audit_service.append_entry(
        db,
        project_id=project_id,
        event_type="attachment_deleted",
        entity_type="attachment",
        actor=_user_to_actor(current_user),
        entity_id=attachment_id,
        entity_label=attachment.filename,
    )
    await db.flush()
