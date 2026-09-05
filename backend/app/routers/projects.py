from datetime import datetime, timezone
import re
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
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
from app.schemas.migration_settings import DataMigrationCycleBlock
from app.schemas.risk import RiskHomeOut, RiskOut
from app.schemas.survey import SurveyDraftOut, SurveyDraftSave
from app.schemas.project import (
    DataMigrationCompleteRequest,
    DataMigrationReopenRequest,
    GovernanceRolesOut,
    GovernanceRolesPatch,
    PlanningPatch,
    ProjectCreate,
    ProjectDetail,
    ProjectHomeItem,
    ProjectListItem,
    ProjectPatch,
    ProjectTablePage,
    ProjectTableRow,
    SectionPatch,
    SurveyNeedPatch,
)
from app.schemas.user import ProjectUserRoleAssignment, UserOut
from app.schemas.risk import RiskOut
from app.schemas.jira_job import JiraJobCreate
from app.services import audit_service, attachment_service, bgi_service, jira_client, jira_service, migration_settings_service, project_service, scoring_service, user_service
from app.config import settings
from app.auth import _user_has_admin_role, _user_has_bgi_cloud_lead_role, _user_has_platform_lead_role, get_current_user, require_admin
from app.models.project import Project
from app.models.user import User
from app.models.cloud_resource import CloudResource
from app.models.project_attachment import ProjectAttachment
from app.schemas.project_attachment import AttachmentOut

router = APIRouter(prefix="/projects", tags=["projects"])


async def _require_bgi_access(
    db: AsyncSession, current_user: User, project: Project
) -> None:
    if _user_has_bgi_cloud_lead_role(current_user.role) and current_user.bgi_ids:
        allowed_ids = await bgi_service.get_descendant_ids_for_multiple(db, current_user.bgi_ids)
        if project.bgi_id not in allowed_ids:
            raise HTTPException(status_code=403, detail="Project not accessible")


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


def _itso_email(p) -> str | None:
    for pu in (p.project_users or []):
        if pu.user and pu.role and "itso" in {r.strip() for r in pu.role.split(",") if r.strip()}:
            return pu.user.email
    return None


def _itso_delegate_name(p) -> str | None:
    for pu in (p.project_users or []):
        if pu.user and pu.role and "itso_delegate" in {r.strip() for r in pu.role.split(",") if r.strip()}:
            return pu.user.name
    return None


def _itso_delegate_email(p) -> str | None:
    for pu in (p.project_users or []):
        if pu.user and pu.role and "itso_delegate" in {r.strip() for r in pu.role.split(",") if r.strip()}:
            return pu.user.email
    return None


def _category_milestone_ids(p) -> list[str]:
    return [cm.id for cm in (p.category_milestones or [])]


def _governance_user_name(p, role: str) -> str | None:
    """Name of the user holding a governance role (gbi_champion, gbi_champion_delegate, ...)."""
    for pu in (p.project_users or []):
        if pu.user and pu.role and role in {r.strip() for r in pu.role.split(",") if r.strip()}:
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
        "gbi_champion": None,
        "gbi_champion_delegate": None,
    }
    for pu in (p.project_users or []):
        if not pu.user:
            continue
        user_roles = {r.strip() for r in (pu.role or "").split(",") if r.strip()}
        for role in (
            "technical_lead",
            "business_owner",
            "dba_data_owner",
            "gbi_champion",
            "gbi_champion_delegate",
        ):
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
        gbi_champion=roles.get("gbi_champion"),
        gbi_champion_delegate=roles.get("gbi_champion_delegate"),
    )


def _derive_status(p, stage_data: dict) -> str:
    if p.status == "blocked":
        return "blocked"
    return project_service.derive_status_from_stage_progress(stage_data)


def _unpack_ctx(ctx) -> tuple:
    """(weights, signoff_enabled) from a progress context tuple, or defaults."""
    return ctx if ctx is not None else (None, True)


def _project_list_item(p, fields: set[str] | None = None, ctx=None) -> ProjectListItem:
    if fields is None:
        weights, signoff_enabled = _unpack_ctx(ctx)
        stage_data = project_service.compute_stage_progress(p, weights, signoff_enabled)
        return ProjectListItem(
            id=p.id,
            name=p.name,
            status=_derive_status(p, stage_data),
            blocked_reason=p.blocked_reason,
            progress=stage_data["overall"],
            description=p.description,
            migration_wave=p.migration_wave,
            itso=_itso_name(p),
            itso_email=_itso_email(p),
            itso_delegate=_itso_delegate_name(p),
            itso_delegate_email=_itso_delegate_email(p),
            jira_base_url=settings.jira_base_url,
            updated_at=p.updated_at.strftime("%d %b %Y").upper() if p.updated_at else None,
            wave_id=p.wave_id,
            jira_story_key=p.jira_story_key,
            jira_job_status=p.jira_job_status,
            planning=p.planning,
            survey_submitted_at=p.survey_submitted_at,
            is_survey_needed=p.is_survey_needed,
            justification_without_survey=p.justification_without_survey,
            data_migration_schedule=p.data_migration_schedule,
            data_migration_survey_submitted_at=p.data_migration_survey_submitted_at,
            stage_progress={k: v for k, v in stage_data.items() if k != "overall"},
            team=_team_from_project_users(p),
            migration_constraints=p.migration_constraints,
            migration_effort_estimation=p.migration_effort_estimation,
            application_overview=p.application_overview,
            dependencies=p.dependencies,
            governance_roles=_governance_roles_from_project_users(p),
            availability=p.availability,
            data_persistence=p.data_persistence,
            nfrs=p.nfrs,
            target_architecture=p.target_architecture,
            engagement=project_service._engagement_to_dict(p),
            approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
            cloud_resources=[CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])],
            bgi_id=p.bgi_id,
            category_milestone_ids=_category_milestone_ids(p),
        )

    data: dict[str, Any] = {}

    if "basic" in fields:
        data.update(
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "blocked_reason": p.blocked_reason,
                "description": p.description,
                "migration_wave": p.migration_wave,
                "wave_id": p.wave_id,
                "jira_story_key": p.jira_story_key,
                "jira_job_status": p.jira_job_status,
                "planning": p.planning,
                "survey_submitted_at": p.survey_submitted_at,
                "is_survey_needed": p.is_survey_needed,
                "justification_without_survey": p.justification_without_survey,
                "data_migration_schedule": p.data_migration_schedule,
                "data_migration_plan": p.data_migration_plan,
                "environment_provision": p.environment_provision,
                "data_migration_survey_submitted_at": p.data_migration_survey_submitted_at,
                "data_migration_survey_submitted_by": p.data_migration_survey_submitted_by,
                "migration_constraints": p.migration_constraints,
                "migration_effort_estimation": p.migration_effort_estimation,
                "application_overview": p.application_overview,
                "jira_base_url": settings.jira_base_url,
                "updated_at": p.updated_at.strftime("%d %b %Y").upper() if p.updated_at else None,
            }
        )

    if "progress" in fields:
        weights, signoff_enabled = _unpack_ctx(ctx)
        stage_data = project_service.compute_stage_progress(p, weights, signoff_enabled)
        data["status"] = _derive_status(p, stage_data)
        data["progress"] = stage_data["overall"]
        data["stage_progress"] = {k: v for k, v in stage_data.items() if k != "overall"}

    if "team" in fields:
        data["team"] = _team_from_project_users(p)

    if "itso" in fields:
        data["itso"] = _itso_name(p)

    if "itso_delegate" in fields:
        data["itso_delegate"] = _itso_delegate_name(p)

    if "governance" in fields:
        data["governance_roles"] = _governance_roles_from_project_users(p)

    if "itso" in fields:
        data["itso"] = _itso_name(p)
        data["itso_email"] = _itso_email(p)

    if "itso_delegate" in fields:
        data["itso_delegate"] = _itso_delegate_name(p)
        data["itso_delegate_email"] = _itso_delegate_email(p)

    if "availability" in fields:
        data["availability"] = p.availability

    if "data_persistence" in fields:
        data["data_persistence"] = p.data_persistence

    if "nfrs" in fields:
        data["nfrs"] = p.nfrs

    if "target_architecture" in fields:
        data["target_architecture"] = p.target_architecture

    if "engagement" in fields:
        data["engagement"] = project_service._engagement_to_dict(p)

    if "resources" in fields or "resources_full" in fields:
        data["cloud_resources"] = [
            CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])
        ]

    if "resource_sets" in fields:
        data["resource_sets"] = sorted({
            r.resource_set for r in (p.cloud_resources or [])
            if r.resource_set
        })

    if "dependencies" in fields:
        data["dependencies"] = p.dependencies

    if "approvals" in fields:
        data["approvals"] = [
            ApprovalOut.model_validate(a) for a in (p.approvals or [])
        ]

    if "risks" in fields:
        data["risks"] = [RiskOut.model_validate(r) for r in (p.risks or [])]

    data["bgi_id"] = p.bgi_id
    data["category_milestone_ids"] = _category_milestone_ids(p)

    return ProjectListItem(**data)


def _project_home_item(p, fields: set[str] | None = None, ctx=None) -> ProjectHomeItem:
    if fields is None:
        weights, signoff_enabled = _unpack_ctx(ctx)
        stage_data = project_service.compute_stage_progress(p, weights, signoff_enabled)
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
            is_survey_needed=p.is_survey_needed,
            justification_without_survey=p.justification_without_survey,
            data_migration_schedule=p.data_migration_schedule,
            data_migration_plan=p.data_migration_plan,
            data_migration_survey_submitted_at=p.data_migration_survey_submitted_at,
            stage_progress={k: v for k, v in stage_data.items() if k != "overall"},
            team=_team_from_project_users(p),
            migration_constraints=p.migration_constraints,
            engagement=project_service._engagement_to_dict(p),
            approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
            cloud_resources=[CloudResourceHomeOut.model_validate(r) for r in (p.cloud_resources or [])],
            risks=[RiskHomeOut.model_validate(r) for r in (p.risks or [])],
            bgi_id=p.bgi_id,
            category_milestone_ids=_category_milestone_ids(p),
        )

    data: dict[str, Any] = {}

    if "basic" in fields:
        data.update(
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "blocked_reason": p.blocked_reason,
                "migration_wave": p.migration_wave,
                "wave_id": p.wave_id,
                "jira_story_key": p.jira_story_key,
                "jira_job_status": p.jira_job_status,
                # HomePage only reads the two date pairs; trim the heavy JSONB blobs.
                "planning": _trim_keys(p.planning, _TABLE_PLANNING_KEYS),
                "survey_submitted_at": p.survey_submitted_at,
                "is_survey_needed": p.is_survey_needed,
                "data_migration_survey_submitted_at": p.data_migration_survey_submitted_at,
                "migration_constraints": _trim_keys(p.migration_constraints, _TABLE_CONSTRAINT_KEYS),
                # ISO so HomePage's string sort is chronological; count avoids
                # serializing full resource rows for the rich card asset count.
                "resource_count": len(p.cloud_resources or []),
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
        )

    if "progress" in fields:
        weights, signoff_enabled = _unpack_ctx(ctx)
        stage_data = project_service.compute_stage_progress(p, weights, signoff_enabled)
        data["status"] = _derive_status(p, stage_data)
        data["progress"] = stage_data["overall"]
        data["stage_progress"] = {k: v for k, v in stage_data.items() if k != "overall"}

    if "team" in fields:
        data["team"] = _team_from_project_users(p)

    if "itso" in fields:
        data["itso"] = _itso_name(p)

    if "itso_delegate" in fields:
        data["itso_delegate"] = _itso_delegate_name(p)

    if "engagement" in fields:
        data["engagement"] = project_service._engagement_to_dict(p)

    if "resources" in fields:
        data["cloud_resources"] = [
            CloudResourceHomeOut.model_validate(r) for r in (p.cloud_resources or [])
        ]

    if "risks" in fields:
        data["risks"] = [RiskHomeOut.model_validate(r) for r in (p.risks or [])]

    if "approvals" in fields:
        data["approvals"] = [
            ApprovalOut.model_validate(a) for a in (p.approvals or [])
        ]

    data["bgi_id"] = p.bgi_id
    data["category_milestone_ids"] = _category_milestone_ids(p)

    return ProjectHomeItem(**data)


def _project_detail(p, ctx=None) -> ProjectDetail:
    weights, signoff_enabled = _unpack_ctx(ctx)
    stage_data = project_service.compute_stage_progress(p, weights, signoff_enabled)
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
        is_survey_needed=p.is_survey_needed,
        justification_without_survey=p.justification_without_survey,
        data_migration_schedule=p.data_migration_schedule,
        data_migration_plan=p.data_migration_plan,
        environment_provision=p.environment_provision,
        data_migration_survey_submitted_at=p.data_migration_survey_submitted_at,
        data_migration_survey_submitted_by=p.data_migration_survey_submitted_by,
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
        engagement=project_service._engagement_to_dict(p),
        cloud_resources=[CloudResourceOut.model_validate(r) for r in (p.cloud_resources or [])],
        risks=[RiskOut.model_validate(r) for r in (p.risks or [])],
        approvals=[ApprovalOut.model_validate(a) for a in (p.approvals or [])],
        bgi_id=p.bgi_id,
        category_milestone_ids=_category_milestone_ids(p),
    )


@router.get("", response_model=list[ProjectListItem])
async def list_projects(
    userId: str | None = None,
    fields: list[str] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    field_set = set(fields) if fields else None
    bgi_ids: list[str] | None = None
    if _user_has_bgi_cloud_lead_role(current_user.role) and current_user.bgi_ids:
        bgi_ids = await bgi_service.get_descendant_ids_for_multiple(db, current_user.bgi_ids)
    projects = await project_service.get_all(db, user_id=userId, fields=field_set, bgi_ids=bgi_ids)
    ctx = await project_service.get_progress_context(db)
    return [_project_list_item(p, fields=field_set, ctx=ctx) for p in projects]


@router.get("/home", response_model=list[ProjectHomeItem], response_model_exclude_none=True)
async def list_projects_home(
    userId: str | None = None,
    fields: list[str] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    field_set = set(fields) if fields else None
    bgi_ids: list[str] | None = None
    if _user_has_bgi_cloud_lead_role(current_user.role) and current_user.bgi_ids:
        bgi_ids = await bgi_service.get_descendant_ids_for_multiple(db, current_user.bgi_ids)
    projects = await project_service.get_all_home(db, user_id=userId, fields=field_set, bgi_ids=bgi_ids)
    ctx = await project_service.get_progress_context(db)
    return [_project_home_item(p, fields=field_set, ctx=ctx) for p in projects]


_TABLE_OVERVIEW_KEYS = (
    "newProjectId",
    "applicationName",
    "baId",
    "systemImportanceClassification",
    "iitaApplicability",
    "migrationStrategy",
)
_TABLE_PLANNING_KEYS = ("startDate", "endDate")
_TABLE_CONSTRAINT_KEYS = ("earliestStartDate", "latestEndDate")


def _trim_keys(source: dict | None, keys: tuple[str, ...]) -> dict | None:
    if not source:
        return None
    trimmed = {k: source[k] for k in keys if k in source}
    return trimmed or None


def _table_planning_payload(p) -> dict | None:
    """Trimmed planning payload whose dates are the derived project timeline
    (milestone union, mirroring the Wave Gantt), falling back to stored dates."""
    derived = project_service.get_derived_project_dates(p)
    stored = _trim_keys(p.planning, _TABLE_PLANNING_KEYS) or {}
    if derived:
        return {"startDate": derived[0], "endDate": derived[1]}
    return stored or None


def _project_table_row(
    p,
    stage_data: dict[str, int],
    effective_status: str,
    has_survey_draft: bool,
) -> ProjectTableRow:
    return ProjectTableRow(
        id=p.id,
        name=p.name,
        status=effective_status,
        progress=stage_data["overall"],
        stage_progress={k: v for k, v in stage_data.items() if k != "overall"},
        survey_submitted_at=p.survey_submitted_at,
        data_migration_survey_submitted_at=p.data_migration_survey_submitted_at,
        has_survey_draft=has_survey_draft,
        bgi_id=p.bgi_id,
        itso=_itso_name(p),
        itso_delegate=_itso_delegate_name(p),
        jira_story_key=p.jira_story_key,
        jira_base_url=settings.jira_base_url,
        is_survey_needed=p.is_survey_needed,
        justification_without_survey=p.justification_without_survey,
        gbi_champion=_governance_user_name(p, "gbi_champion"),
        gbi_champion_delegate=_governance_user_name(p, "gbi_champion_delegate"),
        application_overview=_trim_keys(p.application_overview, _TABLE_OVERVIEW_KEYS),
        planning=_table_planning_payload(p),
        migration_constraints=_trim_keys(p.migration_constraints, _TABLE_CONSTRAINT_KEYS),
        migration_effort_estimation=p.migration_effort_estimation,
        infra_footprint=scoring_service.get_infra_footprint_score(p.cloud_resources or []),
        migration_driver=scoring_service.get_migration_driver_score(
            p.application_overview, p.migration_effort_estimation, p.dependencies
        ),
    )


@router.get("/table", response_model=ProjectTablePage)
async def list_projects_table(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=0, le=1000),
    status: str | None = None,
    search: str | None = None,
    migration_range: str | None = None,
    role: str | None = None,
    role_user_id: str | None = None,
    bgi_ids: list[str] | None = Query(None),
    excluded_bgi_ids: list[str] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated, filtered, lean project rows for the projects table.

    ``page_size=0`` returns all matching rows (used by export).
    Role scoping: leads see everything, others see only projects they belong to.
    """
    is_lead = (
        _user_has_admin_role(current_user.role)
        or _user_has_platform_lead_role(current_user.role)
        or _user_has_bgi_cloud_lead_role(current_user.role)
    )
    member_user_id = None if is_lead else current_user.id
    role_bgi_ids: list[str] | None = None
    if _user_has_bgi_cloud_lead_role(current_user.role) and current_user.bgi_ids:
        role_bgi_ids = await bgi_service.get_descendant_ids_for_multiple(db, current_user.bgi_ids)

    # Frontend sends the compact tree selection (selected nodes + excluded
    # nodes); expand selected nodes to their subtrees here so the query string
    # stays small even for deep hierarchies.
    filter_bgi_ids: list[str] | None = None
    if bgi_ids:
        filter_bgi_ids = await bgi_service.get_descendant_ids_for_multiple(db, bgi_ids)
        if excluded_bgi_ids:
            excluded = set(await bgi_service.get_descendant_ids_for_multiple(db, excluded_bgi_ids))
            filter_bgi_ids = [i for i in filter_bgi_ids if i not in excluded]

    rows, total = await project_service.get_table_page(
        db,
        member_user_id=member_user_id,
        role_bgi_ids=role_bgi_ids,
        filter_bgi_ids=filter_bgi_ids,
        search=search,
        status=status,
        migration_range=migration_range,
        role=role,
        role_user_id=role_user_id,
        page=page,
        page_size=page_size,
    )
    return ProjectTablePage(
        items=[_project_table_row(p, sd, st, hd) for p, sd, st, hd in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/asset-stats", response_model=dict[str, int])
async def get_project_asset_stats(
    userId: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bgi_ids: list[str] | None = None
    if _user_has_bgi_cloud_lead_role(current_user.role) and current_user.bgi_ids:
        bgi_ids = await bgi_service.get_descendant_ids_for_multiple(db, current_user.bgi_ids)
    return await project_service.get_asset_stats(db, user_id=userId, bgi_ids=bgi_ids)


@router.get("/data-migration-cycle-blocks", response_model=list[DataMigrationCycleBlock])
async def get_data_migration_cycle_blocks(
    cycle_start_date: str = Query(..., description="Cycle period start date (YYYY-MM-DD)"),
    cycle_end_date: str = Query(..., description="Cycle period end date (YYYY-MM-DD)"),
    cycle_duration_days: int = Query(..., ge=1, description="Duration of each cycle block in days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return data-migration cycle blocks with current booking counts."""
    return await project_service.get_data_migration_cycle_blocks(
        db, cycle_start_date, cycle_end_date, cycle_duration_days
    )


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actor = _user_to_actor(current_user)
    project = await project_service.create(db, body, actor)
    return _project_detail(project, await project_service.get_progress_context(db))


@router.get("/survey-drafts", response_model=list[str])
async def list_survey_draft_project_ids(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return project IDs that have any survey draft (platform-wide)."""
    return await project_service.get_survey_draft_project_ids(db)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await _require_bgi_access(db, current_user, project)
    return _project_detail(project, await project_service.get_progress_context(db))


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
    """Update governance roles (technical_lead, business_owner, dba_data_owner,
    gbi_champion, gbi_champion_delegate).

    Only Platform Migration Leads may assign or clear these roles.
    """
    if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can manage governance roles.",
        )

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    actor = _user_to_actor(current_user)
    assignments = {
        "technical_lead": body.technicalLeadId,
        "business_owner": body.businessOwnerId,
        "dba_data_owner": body.dbaDataOwnerId,
        "gbi_champion": body.gbiChampionId,
        "gbi_champion_delegate": body.gbiChampionDelegateId,
    }
    try:
        await project_service.update_governance_roles(db, project, assignments, actor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    await db.refresh(project)
    return _project_detail(project, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


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


async def _validate_data_migration_schedule(session: AsyncSession, value: dict[str, Any]) -> None:
    schedule = value or {}
    start = schedule.get("startDate")
    end = schedule.get("endDate")
    if not start or not end:
        return
    mig = await migration_settings_service.get_migration_settings(session)
    cp = mig.data_migration.cycle_period if mig.data_migration else None
    if not cp or not cp.start_date or not cp.end_date:
        return
    if start < cp.start_date or end > cp.end_date:
        raise HTTPException(
            status_code=422,
            detail=f"Data migration schedule must fall within the cycle period ({cp.start_date} to {cp.end_date}).",
        )


def _require_platform_lead_for_block(user: User) -> None:
    if "platform_migration_lead" not in (user.role or ""):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads can block or unblock projects.",
        )


@router.put("/{project_id}/survey-need", response_model=ProjectDetail)
async def update_survey_need(
    project_id: str,
    body: SurveyNeedPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update whether a survey is required and the justification if not.

    Only Platform Migration Leads or Admins can maintain these fields.
    """
    if not _user_has_platform_lead_role(current_user.role) and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can update survey requirement settings.",
        )

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_is_survey_needed = project.is_survey_needed
    old_justification = project.justification_without_survey

    is_survey_needed = body.is_survey_needed
    justification = body.justification_without_survey.strip() if body.justification_without_survey else None
    if is_survey_needed:
        justification = None

    project.is_survey_needed = is_survey_needed
    project.justification_without_survey = justification

    changes: list[dict[str, Any]] = []
    if old_is_survey_needed != is_survey_needed:
        changes.append({
            "field": "is_survey_needed",
            "label": "Survey Required",
            "old_value": old_is_survey_needed,
            "new_value": is_survey_needed,
        })
    if old_justification != justification:
        changes.append({
            "field": "justification_without_survey",
            "label": "Justification Without Survey",
            "old_value": old_justification,
            "new_value": justification,
        })

    if changes:
        await audit_service.append_entry(
            db,
            project_id=project.id,
            event_type="section_updated",
            entity_type="project",
            actor=_user_to_actor(current_user),
            changes=changes,
        )

    await db.flush()
    await db.refresh(project)
    return _project_detail(project, await project_service.get_progress_context(db))


def _resolve_status_if_unblocking(project, new_status: str, ctx=None) -> str:
    """If unblocking, derive the correct status from stage progress."""
    if project.status == "blocked" and new_status != "blocked":
        weights, signoff_enabled = _unpack_ctx(ctx)
        stage_data = project_service.compute_stage_progress(project, weights, signoff_enabled)
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
            patch_data["status"] = _resolve_status_if_unblocking(project, new_status, await project_service.get_progress_context(db))
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
    return _project_detail(project, await project_service.get_progress_context(db))


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
    # The section update endpoint merges nested dicts on JSONB columns, which lets
    # callers PATCH only the keys they want to change. Some callers still send the
    # whole section; that is supported, but it is not required.
    if section_key == "status":
        old_status = project.status
        new_status = value
        if old_status == "blocked" or new_status == "blocked":
            _require_platform_lead_for_block(current_user)
            value = _resolve_status_if_unblocking(project, new_status, await project_service.get_progress_context(db))

    if section_key == "migrationConstraints":
        await _validate_migration_constraints(db, value)

    if section_key == "dataMigrationSchedule":
        await _validate_data_migration_schedule(db, value)

    if section_key == "engagement":
        if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
            raise HTTPException(
                status_code=403,
                detail="Only Platform Migration Leads or Admins can update engagements.",
            )

    if section_key == "dataMigrationPlan":
        existing_plan = project.data_migration_plan or {}
        if existing_plan.get("completedAt"):
            raise HTTPException(
                status_code=400,
                detail="Data migration plan is immutable after completion.",
            )
        if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
            raise HTTPException(
                status_code=403,
                detail="Only Platform Migration Leads or Admins can update the data migration plan.",
            )

    if section_key == "environmentProvision":
        if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
            raise HTTPException(
                status_code=403,
                detail="Only Platform Migration Leads or Admins can update environment provision.",
            )

    if section_key == "applicationOverview":
        if isinstance(value, dict) and "newProjectId" in value:
            current_new_project_id = (project.application_overview or {}).get("newProjectId")
            new_new_project_id = value["newProjectId"]
            if new_new_project_id != current_new_project_id:
                if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
                    raise HTTPException(
                        status_code=403,
                        detail="Only Platform Migration Leads or Admins can update the new project ID mapping.",
                    )
                if new_new_project_id and settings.new_project_id_regex:
                    if not re.fullmatch(settings.new_project_id_regex, str(new_new_project_id)):
                        raise HTTPException(
                            status_code=400,
                            detail="New Project ID must match the configured naming convention.",
                        )

    actor = _user_to_actor(current_user)
    try:
        project = await project_service.update_section(db, project, section_key, value, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _project_detail(project, await project_service.get_progress_context(db))


@router.get("/{project_id}/audit-log", response_model=AuditLogResponse)
async def get_project_audit_log(
    project_id: str,
    limit: int = Query(100, ge=1, le=1000, description="Maximum entries to return"),
    offset: int = Query(0, ge=0, description="Number of entries to skip"),
    db: AsyncSession = Depends(get_db),
):
    entries = await audit_service.get_by_project(db, project_id, limit=limit, offset=offset)
    total = await audit_service.count_by_project(db, project_id)
    return AuditLogResponse(
        entries=[AuditLogEntryOut.from_orm_entry(e) for e in entries],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/{project_id}/audit-log/{entry_id}/restore", response_model=ProjectDetail)
async def restore_audit_log_entry(
    project_id: str,
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Restore a section from an audit log entry (admin only). Currently supports applicationOverview."""
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    entry = await audit_service.get_by_id(db, entry_id)
    if not entry or entry.project_id != project_id:
        raise HTTPException(status_code=404, detail="Audit log entry not found")

    if entry.event_type != "section_updated":
        raise HTTPException(status_code=400, detail="Only section update entries can be restored")

    if entry.section_key != "applicationOverview":
        raise HTTPException(status_code=400, detail="Only applicationOverview sections can be restored")

    actor = _user_to_actor(current_user)

    # Snapshot the current section before restoring
    column = project_service.SECTION_COLUMN_MAP.get(entry.section_key)
    current_state = getattr(project, column, None) or {}

    if entry.old_snapshot:
        restored = entry.old_snapshot
    else:
        # Best-effort reconstruction from current section + reverse changes
        restored = dict(current_state)
        for change in (entry.changes or []):
            field = change.get("field")
            old_value = change.get("old_value")
            if field is not None:
                restored[field] = old_value

    # Compute the actual field-level diff for the audit log
    restore_changes = project_service._diff_section(current_state, restored)

    project = await project_service.update_section(
        db, project, "applicationOverview", restored, actor, skip_audit=True
    )

    # Build comprehensive changes: restored fields + metadata
    audit_changes: list[dict[str, Any]] = [
        {
            "field": "restored_from_entry",
            "label": "Restored from entry",
            "old_value": None,
            "new_value": entry_id,
        },
        *restore_changes,
    ]

    # Log the restore action itself
    await audit_service.append_entry(
        db,
        project_id=project_id,
        event_type="section_restored",
        entity_type="section",
        actor=actor,
        section_key="applicationOverview",
        section_label=project_service.SECTION_LABELS.get("applicationOverview", "applicationOverview"),
        changes=audit_changes,
    )
    await db.flush()
    await db.refresh(project)
    return _project_detail(project, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


@router.post("/{project_id}/data-migration-survey-submitted", response_model=ProjectDetail)
async def mark_data_migration_survey_submitted(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.data_migration_survey_submitted_at = datetime.now(timezone.utc)
    project.data_migration_survey_submitted_by = current_user.id
    await audit_service.append_entry(
        db,
        project_id=project_id,
        event_type="data_migration_survey_submitted",
        entity_type="project",
        actor=_user_to_actor(current_user),
    )
    await db.flush()
    await db.refresh(project)
    return _project_detail(project, await project_service.get_progress_context(db))


@router.post("/{project_id}/data-migration-complete", response_model=ProjectDetail)
async def mark_data_migration_complete(
    project_id: str,
    body: DataMigrationCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_member = any(pu.user_id == current_user.id for pu in (project.project_users or []))
    is_platform_lead = "platform_migration_lead" in (current_user.role or "")
    if not is_member and not is_platform_lead and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Only project members, platform leads, or admins can mark data migration as complete.",
        )

    actor = _user_to_actor(current_user)
    updated = await project_service.mark_data_migration_complete(db, project, body.remark, actor)
    return _project_detail(updated, await project_service.get_progress_context(db))


@router.post("/{project_id}/data-migration-reopen", response_model=ProjectDetail)
async def mark_data_migration_reopen(
    project_id: str,
    body: DataMigrationReopenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_platform_lead = "platform_migration_lead" in (current_user.role or "")
    if not is_platform_lead and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can reopen a completed data migration plan.",
        )

    plan = project.data_migration_plan or {}
    if not plan.get("completedAt"):
        raise HTTPException(
            status_code=400,
            detail="Data migration plan is not completed.",
        )

    actor = _user_to_actor(current_user)
    updated = await project_service.mark_data_migration_reopen(db, project, body.reason.strip(), actor)
    return _project_detail(updated, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


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
    return _project_detail(project, await project_service.get_progress_context(db))


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
