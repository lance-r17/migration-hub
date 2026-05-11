from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.approval import ApprovalOut
from app.schemas.audit_log import AuditLogEntryOut, AuditLogResponse
from app.schemas.cloud_resource import (
    CloudResourceHomeOut,
    CloudResourceOut,
    ResourceSpecsBatchUpdate,
    ResourcesBatchDelete,
    ResourcesBatchUpsert,
)
from app.schemas.risk import RiskHomeOut
from app.schemas.survey import SurveyDraftOut, SurveyDraftSave
from app.schemas.project import (
    GovernanceRolesOut,
    GovernanceRolesPatch,
    PlanningPatch,
    ProjectCreate,
    ProjectDetail,
    ProjectHomeItem,
    ProjectListItem,
    ProjectPatch,
    SectionPatch,
)
from app.schemas.user import ProjectUserRoleAssignment, UserOut
from app.schemas.risk import RiskOut
from app.schemas.jira_job import JiraJobCreate
from app.services import audit_service, attachment_service, jira_client, jira_service, migration_settings_service, project_service, user_service
from app.config import settings
from app.auth import get_current_user, require_admin
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


def _itso_name(p) -> str | None:
    for pu in (p.project_users or []):
        if pu.user and pu.role and "itso" in {r.strip() for r in pu.role.split(",") if r.strip()}:
            return pu.user.name
    return None


def _itso_delegate_name(p) -> str | None:
    for pu in (p.project_users or []):
        if pu.user and pu.role and "itso_delegate" in {r.strip() for r in pu.role.split(",") if r.strip()}:
            return pu.user.name
    return None


def _team_from_project_users(p) -> list[dict]:
    return [
        {"id": pu.user.id, "name": pu.user.name, "initials": pu.user.initials}
        for pu in (p.project_users or [])
        if pu.user is not None
    ]


def _governance_roles_from_project_users(p) -> GovernanceRolesOut | None:
    roles: dict[str, dict | None] = {
        "technical_lead": None,
        "business_owner": None,
        "dba_data_owner": None,
    }
    for pu in (p.project_users or []):
        if not pu.user:
            continue
        user_roles = {r.strip() for r in (pu.role or "").split(",") if r.strip()}
        for role in ("technical_lead", "business_owner", "dba_data_owner"):
            if role in user_roles:
                roles[role] = {
                    "id": pu.user.id,
                    "name": pu.user.name,
                    "email": pu.user.email,
                    "department": pu.user.department,
                    "initials": pu.user.initials,
                }
    return GovernanceRolesOut(
        technical_lead=roles.get("technical_lead"),
        business_owner=roles.get("business_owner"),
        dba_data_owner=roles.get("dba_data_owner"),
    )


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
        blocked_reason=p.blocked_reason,
        progress=stage_data["overall"],
        description=p.description,
        migration_wave=p.migration_wave,
        itso=_itso_name(p),
        itso_delegate=_itso_delegate_name(p),
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
        migration_effort_estimation=p.migration_effort_estimation,
        application_overview=p.application_overview,
        approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
        cloud_resources=[CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])],
    )


def _project_home_item(p) -> ProjectHomeItem:
    stage_data = project_service.compute_stage_progress(p)
    return ProjectHomeItem(
        id=p.id,
        name=p.name,
        status=_derive_status(p, stage_data),
        blocked_reason=p.blocked_reason,
        progress=stage_data["overall"],
        description=p.description,
        migration_wave=p.migration_wave,
        itso=_itso_name(p),
        itso_delegate=_itso_delegate_name(p),
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
        cloud_resources=[CloudResourceHomeOut.model_validate(r) for r in (p.cloud_resources or [])],
        risks=[RiskHomeOut.model_validate(r) for r in (p.risks or [])],
    )


def _project_detail(p) -> ProjectDetail:
    stage_data = project_service.compute_stage_progress(p)
    return ProjectDetail(
        id=p.id,
        name=p.name,
        status=_derive_status(p, stage_data),
        blocked_reason=p.blocked_reason,
        progress=stage_data["overall"],
        description=p.description,
        migration_wave=p.migration_wave,
        itso=_itso_name(p),
        itso_delegate=_itso_delegate_name(p),
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
        governance_roles=_governance_roles_from_project_users(p),
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


@router.get("/home", response_model=list[ProjectHomeItem])
async def list_projects_home(
    userId: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    projects = await project_service.get_all_home(db, user_id=userId)
    return [_project_home_item(p) for p in projects]


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actor = _user_to_actor(current_user)
    project = await project_service.create(db, body, actor)
    return _project_detail(project)


@router.get("/survey-drafts", response_model=list[str])
async def list_survey_draft_project_ids(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return project IDs that have a survey draft for the current user."""
    return await project_service.get_survey_draft_project_ids(db, current_user.id)


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


@router.put("/{project_id}/governance-roles", response_model=ProjectDetail)
async def update_governance_roles(
    project_id: str,
    body: GovernanceRolesPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update governance roles (technical_lead, business_owner, dba_data_owner).

    Only Platform Migration Leads may assign or clear these roles.
    """
    if "platform_migration_lead" not in (current_user.role or ""):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads can manage governance roles.",
        )

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    actor = _user_to_actor(current_user)
    assignments = {
        "technical_lead": body.technicalLeadId,
        "business_owner": body.businessOwnerId,
        "dba_data_owner": body.dbaDataOwnerId,
    }
    await project_service.update_governance_roles(db, project, assignments, actor)
    await db.refresh(project)
    return _project_detail(project)


@router.put("/{project_id}/project-user-roles", response_model=ProjectDetail)
async def update_project_user_roles(
    project_id: str,
    body: list[ProjectUserRoleAssignment],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert project user roles for a single project.

    Each assignment replaces the roles for the specified user.
    An empty `roles` list deletes the project_users row.
    Users not in the payload are untouched.
    """
    if not current_user.is_service_account:
        raise HTTPException(
            status_code=403,
            detail="Only service accounts can manage project user roles",
        )

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    actor = _user_to_actor(current_user)
    assignments = [a.model_dump() for a in body]
    await project_service.update_project_user_roles(db, project, assignments, actor)
    await db.refresh(project)
    return _project_detail(project)


async def _validate_migration_constraints(session: AsyncSession, value: dict[str, Any]) -> None:
    mc = value or {}
    start = mc.get("earliestStartDate")
    end = mc.get("latestEndDate")
    if not start or not end:
        return
    mig = await migration_settings_service.get_migration_settings(session)
    pp = mig.platform_period
    if not pp or not pp.start_date or not pp.end_date:
        return
    if start < pp.start_date or end > pp.end_date:
        raise HTTPException(
            status_code=422,
            detail=f"Migration constraints must fall within the platform migration period ({pp.start_date} to {pp.end_date}).",
        )


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
    unblocking = False
    if "status" in patch_data:
        old_status = project.status
        new_status = patch_data["status"]
        if old_status == "blocked" or new_status == "blocked":
            _require_platform_lead_for_block(current_user)
            patch_data["status"] = _resolve_status_if_unblocking(project, new_status)
            if patch_data["status"] != "blocked":
                unblocking = True
        body = ProjectPatch(**patch_data)

    actor = _user_to_actor(current_user)
    if unblocking:
        project.blocked_reason = None
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

    if section_key == "migrationConstraints":
        await _validate_migration_constraints(db, value)

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


@router.get("/{project_id}/survey-draft", response_model=SurveyDraftOut | None)
async def get_survey_draft(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = await project_service.get_survey_draft(db, current_user.id, project_id)
    if draft is None:
        return None
    return SurveyDraftOut.model_validate(draft)


@router.put("/{project_id}/survey-draft", response_model=SurveyDraftOut)
async def save_survey_draft(
    project_id: str,
    body: SurveyDraftSave,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = await project_service.save_survey_draft(
        db, current_user.id, project_id, body.payload.model_dump()
    )
    return SurveyDraftOut.model_validate(draft)


@router.delete("/{project_id}/survey-draft", status_code=204)
async def delete_survey_draft(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await project_service.delete_survey_draft(db, current_user.id, project_id)
    return None


@router.post("/{project_id}/reset", response_model=ProjectDetail)
async def reset_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Reset a project, preserving application overview, team, resources, and attachments.

    Requires admin role.
    """

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    actor = _user_to_actor(current_user)
    project = await project_service.reset_project(db, project, actor)
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
