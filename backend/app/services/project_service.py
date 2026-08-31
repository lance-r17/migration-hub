import math
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes, selectinload

from app.models.approval import Approval
from app.models.cloud_resource import CloudResource
from app.models.engagement import Engagement
from app.models.project import Project
from app.models.risk import Risk
from app.models.survey_draft import SurveyDraft
from app.models.user import User
from app.schemas.migration_settings import DataMigrationCycleBlock
from app.schemas.project import ProjectCreate, ProjectPatch
from app.services import audit_service, attachment_service

# Field group → ORM relationships required
_FIELD_REL_REQUIREMENTS: dict[str, set[str]] = {
    "progress": {"cloud_resources", "project_users", "approvals"},
    "team": {"project_users"},
    "itso": {"project_users"},
    "itso_delegate": {"project_users"},
    "governance": {"project_users"},
    "resources": {"cloud_resources"},
    "resources_full": {"cloud_resources"},
    "resource_sets": {"cloud_resources"},
    "risks": {"risks"},
    "approvals": {"approvals"},
    "engagement": {"engagement"},
    "category_milestones": {"category_milestones"},
}


def _resolve_rels(fields: set[str] | None, default_rels: set[str]) -> set[str]:
    if fields is None:
        return default_rels
    rels: set[str] = set()
    for f, req in _FIELD_REL_REQUIREMENTS.items():
        if f in fields:
            rels.update(req)
    return rels


# Maps camelCase frontend section keys → ORM column names
SECTION_COLUMN_MAP: dict[str, str | None] = {
    "applicationOverview": "application_overview",
    "availability": "availability",
    "dataPersistence": "data_persistence",
    "dependencies": "dependencies",
    "nfrs": "nfrs",
    "migrationConstraints": "migration_constraints",
    "targetArchitecture": "target_architecture",
    "migrationEffortEstimation": "migration_effort_estimation",
    "dataMigrationSchedule": "data_migration_schedule",
    "dataMigrationPlan": "data_migration_plan",
    "environmentProvision": "environment_provision",
    "jiraSubtaskConfig": "jira_subtask_config",
    "status": "status",
    "waveId": "wave_id",
    # Special: delegate to relational tables
    "currentInfrastructure": None,
    "risks": None,
    "approvals": None,
    "engagement": None,
}

# Sections whose JSONB value is replaced wholesale on PATCH (keys can be intentionally cleared)
SECTION_REPLACE_WHOLESALE = {"dataMigrationSchedule", "environmentProvision"}

SECTION_LABELS: dict[str, str] = {
    "applicationOverview": "Application Overview",
    "availability": "Availability & Resilience",
    "dataPersistence": "Data & Persistence",
    "dependencies": "Dependencies",
    "nfrs": "Non-Functional Requirements",
    "migrationConstraints": "Migration Constraints",
    "targetArchitecture": "Target Architecture",
    "migrationEffortEstimation": "Migration Effort Estimation",
    "dataMigrationSchedule": "Data Migration Schedule",
    "dataMigrationPlan": "Data Migration Plan",
    "environmentProvision": "Environment Provision",
    "engagement": "Engagement",
    "status": "Project Status",
    "waveId": "Migration Wave",
}

# Approval sequence helpers — the GBI step uses the assigned champion/delegate
# if one exists on the project, otherwise defaults to gbi_champion.
GBI_ROLES = ("gbi_champion", "gbi_champion_delegate")


def _get_gbi_role(items: list[Any] | None) -> str:
    """Return the GBI approval role present in the given approval items.

    Items may be Approval ORM instances or plain dicts. Defaults to gbi_champion.
    """
    if items:
        for item in items:
            role = getattr(item, "role", None)
            if role is None and isinstance(item, dict):
                role = item.get("role")
            if role in GBI_ROLES:
                return role
    return "gbi_champion"


def approval_sequence_for_project(approvals: list[Any] | None = None) -> list[str]:
    """Return the ordered approval sequence for a project."""
    gbi_role = _get_gbi_role(approvals)
    return ["technical_lead", gbi_role, "platform_migration_lead"]


_STAGE_WEIGHTS = {"setup": 5, "survey": 15, "signoff": 10, "migration": 70}


def compute_stage_progress(project: "Project") -> dict[str, int]:
    """Compute per-stage progress (0-100) and weighted overall progress."""
    has_resources = any(r.need_migration for r in (project.cloud_resources or []))
    governance_roles = {"technical_lead", "business_owner", "dba_data_owner", "gbi_champion", "gbi_champion_delegate"}
    has_team = any(
        r.strip() in governance_roles
        for pu in (project.project_users or [])
        for r in (pu.role or "").split(",")
    )
    setup = 100 if (has_resources and has_team) else 0

    survey = 100 if project.survey_submitted_at is not None else 0

    seq = approval_sequence_for_project(project.approvals)
    approved = sum(
        1 for a in (project.approvals or []) if a.status == "approved" and a.role in seq
    )
    signoff = round(approved / len(seq) * 100) if seq else 0

    in_scope = [r for r in (project.cloud_resources or []) if r.need_migration]
    migration = round(sum(1 for r in in_scope if r.migration_completed) / len(in_scope) * 100) if in_scope else 0

    overall = round(
        setup * _STAGE_WEIGHTS["setup"] / 100
        + survey * _STAGE_WEIGHTS["survey"] / 100
        + signoff * _STAGE_WEIGHTS["signoff"] / 100
        + migration * _STAGE_WEIGHTS["migration"] / 100
    )
    return {"setup": setup, "survey": survey, "signoff": signoff, "migration": migration, "overall": overall}


def derive_status_from_stage_progress(stage_data: dict[str, int]) -> str:
    """Derive project status from stage progress percentages.

    Rules:
      - setup == 0                          -> planning
      - setup == 100 && survey < 100        -> in-progress
      - setup == 100 && survey == 100 && signoff < 100 -> in-progress
      - setup == 100 && survey == 100 && signoff == 100 && migration == 0 -> signed-off
      - setup == 100 && survey == 100 && signoff == 100 && migration > 0 && migration < 100 -> migrating
      - setup == 100 && survey == 100 && signoff == 100 && migration == 100 -> completed
    """
    setup = stage_data.get("setup", 0)
    survey = stage_data.get("survey", 0)
    signoff = stage_data.get("signoff", 0)
    migration = stage_data.get("migration", 0)

    if setup == 0:
        return "planning"
    if survey < 100:
        return "in-progress"
    if signoff < 100:
        return "in-progress"
    if migration == 0:
        return "signed-off"
    if migration < 100:
        return "migrating"
    return "completed"


async def _derive_and_store_status(session: AsyncSession, project: "Project") -> None:
    stage_data = compute_stage_progress(project)
    if project.status != "blocked":
        project.status = derive_status_from_stage_progress(stage_data)


def _to_label(key: str) -> str:
    s = re.sub(r'([A-Z])', r' \1', key).strip()
    return s[0].upper() + s[1:] if s else key


def _diff_section(old: Any, new: Any) -> list[dict]:
    """Return field-level changes between two section dicts."""
    if not isinstance(old, dict) or not isinstance(new, dict):
        if str(old) != str(new):
            return [{"field": "value", "label": "Value", "old_value": old, "new_value": new}]
        return []
    changes = []
    all_keys = set(list((old or {}).keys()) + list((new or {}).keys()))
    for key in all_keys:
        old_val = (old or {}).get(key)
        new_val = (new or {}).get(key)
        if old_val != new_val:
            changes.append({"field": key, "label": _to_label(key), "old_value": old_val, "new_value": new_val})
    return changes


_RESOURCE_FIELD_MAP = {
    "syncStatus":         ("sync_status",         "Sync Status"),
    "needMigration":      ("need_migration",       "In Migration Scope"),
    "migrationCompleted": ("migration_completed",  "Migration Completed"),
    "subApplication":     ("sub_application",      "Sub Application"),
    "targetResourceId":   ("target_resource_id",   "Target Resource ID"),
}

# Complete label map for the upsert endpoint (all updatable columns, snake_case)
_RESOURCE_LABEL_MAP: dict[str, str] = {
    "resource_id":         "Resource ID",
    "name":                "Name",
    "product":             "Product",
    "resource_set":        "Resource Set",
    "sub_application":     "Sub Application",
    "target_resource_id":  "Target Resource ID",
    "sync_status":         "Sync Status",
    "need_migration":      "In Migration Scope",
    "migration_completed": "Migration Completed",
    "jira_subtask_key":    "Jira Subtask Key",
}


def _classify_resource_changes(
    old_list: list, new_list: list[dict]
) -> list[tuple[str, str, list[dict], bool, str]]:
    """Returns (resource_id, entity_label, changes, is_sync_complete, action) per changed resource.

    action is one of: "added", "removed", "updated"
    """
    result = []
    old_map = {r.resource_id: r for r in old_list}
    new_map = {r_data["resourceId"]: r_data for r_data in new_list if r_data.get("resourceId")}

    for rid, r in old_map.items():
        if rid not in new_map:
            result.append((rid, r.name, [], False, "removed"))

    for rid, r_data in new_map.items():
        name = r_data.get("name", rid)
        old_r = old_map.get(rid)
        if old_r is None:
            result.append((rid, name, [], False, "added"))
            continue
        changes = []
        for api_key, (col, label) in _RESOURCE_FIELD_MAP.items():
            old_val = getattr(old_r, col)
            new_val = r_data.get(api_key, old_val)
            if old_val != new_val:
                changes.append({"field": api_key, "label": label, "old_value": old_val, "new_value": new_val})
        spec_changes = _diff_section(old_r.specs or {}, r_data.get("specs") or {})
        changes.extend(spec_changes)
        if changes:
            is_sync_complete = any(
                c["field"] == "syncStatus" and c["new_value"] == "synced" for c in changes
            )
            result.append((rid, name, changes, is_sync_complete, "updated"))

    return result


def _project_options():
    from app.models.project_user import ProjectUser
    return [
        selectinload(Project.cloud_resources),
        selectinload(Project.risks),
        selectinload(Project.approvals),
        selectinload(Project.wave),
        selectinload(Project.project_users).selectinload(ProjectUser.user),
        selectinload(Project.engagement),
        selectinload(Project.category_milestones),
    ]


def _generate_cycle_blocks(
    cycle_start_date: str,
    cycle_end_date: str,
    cycle_duration_days: int,
) -> list[dict[str, str]]:
    """Generate consecutive cycle blocks covering the cycle period."""
    from datetime import datetime, timedelta

    start = datetime.strptime(cycle_start_date, "%Y-%m-%d").date()
    end = datetime.strptime(cycle_end_date, "%Y-%m-%d").date()
    duration = timedelta(days=cycle_duration_days)
    blocks: list[dict[str, str]] = []
    current = start
    while current <= end:
        block_end = min(current + duration - timedelta(days=1), end)
        blocks.append({
            "start_date": current.isoformat(),
            "end_date": block_end.isoformat(),
        })
        current = block_end + timedelta(days=1)
    return blocks


async def get_data_migration_cycle_blocks(
    session: AsyncSession,
    cycle_start_date: str,
    cycle_end_date: str,
    cycle_duration_days: int,
) -> list[DataMigrationCycleBlock]:
    """Return cycle blocks with the number of projects and ASR-DR licenses booked."""
    blocks = _generate_cycle_blocks(cycle_start_date, cycle_end_date, cycle_duration_days)
    if not blocks:
        return []

    result = await session.execute(
        select(Project.data_migration_schedule).where(
            Project.data_migration_schedule.is_not(None),
        )
    )
    schedules = [row for row in result.scalars().all() if row]

    def _overlaps(schedule: dict, block: dict[str, str]) -> bool:
        start = schedule.get("startDate")
        end = schedule.get("endDate")
        if not start or not end:
            return False
        return start < block["end_date"] and end > block["start_date"]

    def _needs_asr_dr(schedule: dict) -> bool:
        return bool(schedule.get("needAsrDr"))

    return [
        DataMigrationCycleBlock(
            start_date=block["start_date"],
            end_date=block["end_date"],
            booked_count=sum(1 for s in schedules if _overlaps(s, block)),
            asr_dr_booked_count=sum(
                1 for s in schedules if _overlaps(s, block) and _needs_asr_dr(s)
            ),
        )
        for block in blocks
    ]


async def get_all(
    session: AsyncSession, user_id: str | None = None, fields: set[str] | None = None, bgi_ids: list[str] | None = None
) -> list[Project]:
    from app.models.project_user import ProjectUser

    rels = _resolve_rels(fields, {"approvals", "cloud_resources", "wave", "project_users", "engagement", "category_milestones"})
    options = []
    if "approvals" in rels:
        options.append(selectinload(Project.approvals))
    if "cloud_resources" in rels:
        options.append(selectinload(Project.cloud_resources))
    if "risks" in rels:
        options.append(selectinload(Project.risks))
    if "wave" in rels:
        options.append(selectinload(Project.wave))
    if "project_users" in rels:
        options.append(selectinload(Project.project_users).selectinload(ProjectUser.user))
    if "engagement" in rels:
        options.append(selectinload(Project.engagement))
    # Always load category_milestones because _project_list_item unconditionally reads it
    options.append(selectinload(Project.category_milestones))

    q = select(Project).options(*options)
    if user_id:
        q = q.join(ProjectUser, ProjectUser.project_id == Project.id).where(
            ProjectUser.user_id == user_id
        )
    if bgi_ids:
        q = q.where(Project.bgi_id.in_(bgi_ids))
    result = await session.execute(q.order_by(Project.name))
    return list(result.scalars().all())


# ─── Projects table (paginated, filtered) ────────────────────────────────────

_DERIVED_STATUS_FILTERS = {
    "awaiting-survey",
    "drafting-survey",
    "survey-submitted",
    "awaiting-signoff",
}


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    # JS `new Date(...)` treats date-only strings as UTC; mirror that.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _iso_date(value: Any) -> str | None:
    """Return a 'yyyy-MM-dd' string for date-like values, else None."""
    if not value or not isinstance(value, str):
        return None
    return value[:10] if len(value) >= 10 and value[4] == "-" else None


def get_derived_project_dates(project: "Project") -> tuple[str, str] | None:
    """Project timeline derived from the union of its milestones — mirrors
    ``deriveProjectDates`` in frontend/src/components/waves/WaveGanttChart.tsx:

    planning.milestones (excluding entries shadowed by assigned category milestones)
    + env-provision dev/prod dates + data-migration plan/schedule (incl. cycleBlocks)
    + assigned category milestones (per-project overrides, else global CM dates).
    """
    planning = project.planning or {}
    milestones = planning.get("milestones") or []
    overrides = planning.get("categoryMilestoneOverrides") or {}
    assigned_cm_ids = {cm.id for cm in (project.category_milestones or [])}

    starts: list[str] = []
    ends: list[str] = []

    def push(start: Any, end: Any) -> None:
        s, e = _iso_date(start), _iso_date(end)
        if s and e:
            starts.append(s)
            ends.append(e)

    for m in milestones:
        if not isinstance(m, dict) or m.get("id") in assigned_cm_ids:
            continue
        push(m.get("start"), m.get("end"))

    provision = project.environment_provision or {}
    for env in ("dev", "prod"):
        entry = provision.get(env)
        if isinstance(entry, dict) and entry.get("date"):
            push(entry["date"], entry["date"])

    dm = project.data_migration_plan or project.data_migration_schedule or {}
    push(dm.get("startDate"), dm.get("endDate"))
    for block in dm.get("cycleBlocks") or []:
        if isinstance(block, dict):
            push(block.get("startDate"), block.get("endDate"))

    for cm in project.category_milestones or []:
        override = overrides.get(cm.id) or {}
        push(override.get("start") or cm.start_date, override.get("end") or cm.end_date)

    if not starts:
        return None
    return min(starts), max(ends)


def get_migration_period_days(project: "Project") -> int | None:
    """Days between derived migration start/end (milestone union), falling back to
    constraints, then wave dates. Mirrors ``getMigrationPeriodDays`` in
    frontend/src/lib/export-report.ts.
    """
    start_s: str | None = None
    end_s: str | None = None
    derived = get_derived_project_dates(project)
    if derived:
        start_s, end_s = derived
    if not start_s or not end_s:
        planning = project.planning or {}
        start_s = planning.get("startDate")
        end_s = planning.get("endDate")
    if not start_s or not end_s:
        constraints = project.migration_constraints or {}
        start_s = constraints.get("earliestStartDate")
        end_s = constraints.get("latestEndDate")
    if (not start_s or not end_s) and project.wave:
        start_s = project.wave.start_date
        end_s = project.wave.cutover_date
    start = _parse_iso_datetime(start_s)
    end = _parse_iso_datetime(end_s)
    if not start or not end:
        return None
    return math.ceil((end - start).total_seconds() / 86400)


def _matches_migration_range(days: int | None, migration_range: str) -> bool:
    if days is None:
        return False
    if migration_range == "lt30":
        return days < 30
    if migration_range == "30to90":
        return 30 <= days < 90
    if migration_range == "90to180":
        return 90 <= days < 180
    if migration_range == "gte180":
        return days >= 180
    return True


def _project_has_role_user(project: "Project", role: str, user_id: str) -> bool:
    """True when user_id holds the given comma-separated project role on this project."""
    for pu in project.project_users or []:
        if pu.user_id != user_id or not pu.role:
            continue
        if role in {r.strip() for r in pu.role.split(",") if r.strip()}:
            return True
    return False


def _matches_status_filter(
    effective_status: str,
    stage_data: dict[str, int],
    status_filter: str,
    has_draft: bool,
) -> bool:
    """Mirrors the status-filter predicates in frontend ProjectsPage."""
    setup = stage_data.get("setup", 0)
    survey = stage_data.get("survey", 0)
    signoff = stage_data.get("signoff", 0)
    if status_filter == "drafting-survey":
        return effective_status == "in-progress" and setup == 100 and survey < 100 and has_draft
    if status_filter == "awaiting-survey":
        return effective_status == "in-progress" and setup == 100 and survey < 100 and not has_draft
    if status_filter == "survey-submitted":
        return effective_status == "in-progress" and setup == 100 and survey == 100 and signoff == 0
    if status_filter == "awaiting-signoff":
        return effective_status == "in-progress" and setup == 100 and survey == 100 and 0 < signoff < 100
    return effective_status == status_filter


async def get_table_page(
    session: AsyncSession,
    *,
    member_user_id: str | None = None,
    role_bgi_ids: list[str] | None = None,
    filter_bgi_ids: list[str] | None = None,
    search: str | None = None,
    status: str | None = None,
    migration_range: str | None = None,
    role: str | None = None,
    role_user_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[tuple["Project", dict[str, int], str, bool]], int]:
    """Return (page rows, total) for the projects table.

    Each row is a tuple of (project, stage_data, effective_status, has_survey_draft).
    ``page_size == 0`` returns all matching rows (used by export).
    """
    from sqlalchemy import or_

    from app.models.project_user import ProjectUser

    q = select(Project).options(
        selectinload(Project.cloud_resources),
        selectinload(Project.approvals),
        selectinload(Project.category_milestones),
        selectinload(Project.wave),
        selectinload(Project.project_users).selectinload(ProjectUser.user),
    )
    if member_user_id:
        q = q.join(ProjectUser, ProjectUser.project_id == Project.id).where(
            ProjectUser.user_id == member_user_id
        )
    if role_bgi_ids is not None:
        q = q.where(Project.bgi_id.in_(role_bgi_ids))
    if filter_bgi_ids:
        q = q.where(Project.bgi_id.in_(filter_bgi_ids))
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.where(
            or_(
                Project.name.ilike(like),
                Project.id.ilike(like),
                Project.application_overview["applicationName"].astext.ilike(like),
                Project.application_overview["baId"].astext.ilike(like),
            )
        )

    result = await session.execute(q.order_by(Project.name))
    candidates = list(result.scalars().all())

    draft_ids = set(await get_survey_draft_project_ids(session))

    rows: list[tuple["Project", dict[str, int], str, bool]] = []
    for project in candidates:
        stage_data = compute_stage_progress(project)
        effective_status = (
            "blocked"
            if project.status == "blocked"
            else derive_status_from_stage_progress(stage_data)
        )
        has_draft = project.id in draft_ids
        if status and status != "all":
            if not _matches_status_filter(effective_status, stage_data, status, has_draft):
                continue
        if migration_range and migration_range != "all":
            if not _matches_migration_range(get_migration_period_days(project), migration_range):
                continue
        if role and role_user_id:
            if not _project_has_role_user(project, role, role_user_id):
                continue
        rows.append((project, stage_data, effective_status, has_draft))

    total = len(rows)
    if page_size > 0:
        start = (page - 1) * page_size
        rows = rows[start : start + page_size]
    return rows, total


async def get_all_home(
    session: AsyncSession, user_id: str | None = None, fields: set[str] | None = None, bgi_ids: list[str] | None = None
) -> list[Project]:
    from app.models.project_user import ProjectUser

    rels = _resolve_rels(fields, {"approvals", "cloud_resources", "risks", "project_users", "engagement", "category_milestones"})
    options = []
    if "approvals" in rels:
        options.append(selectinload(Project.approvals))
    if "cloud_resources" in rels:
        options.append(selectinload(Project.cloud_resources))
    if "risks" in rels:
        options.append(selectinload(Project.risks))
    if "project_users" in rels:
        options.append(selectinload(Project.project_users).selectinload(ProjectUser.user))
    if "engagement" in rels:
        options.append(selectinload(Project.engagement))
    # Always load category_milestones because _project_home_item unconditionally reads it
    options.append(selectinload(Project.category_milestones))

    q = select(Project).options(*options)
    if user_id:
        q = q.join(ProjectUser, ProjectUser.project_id == Project.id).where(
            ProjectUser.user_id == user_id
        )
    if bgi_ids:
        q = q.where(Project.bgi_id.in_(bgi_ids))
    result = await session.execute(q.order_by(Project.name))
    return list(result.scalars().all())


async def get_all_for_stats(
    session: AsyncSession,
) -> list[Project]:
    q = select(Project).options(
        selectinload(Project.approvals),
        selectinload(Project.cloud_resources),
        selectinload(Project.project_users),
    )
    result = await session.execute(q.order_by(Project.name))
    return list(result.scalars().all())


async def get_asset_stats(
    session: AsyncSession, user_id: str | None = None, bgi_ids: list[str] | None = None
) -> dict[str, int]:
    """Return aggregated cloud-resource counts grouped by product category."""
    from app.models.project_user import ProjectUser
    from app.services.product_category_service import get_category_for_product

    q = select(CloudResource.product, func.count(CloudResource.resource_id))
    if user_id or bgi_ids:
        q = q.join(Project, Project.id == CloudResource.project_id)
    if user_id:
        q = (
            q.join(ProjectUser, ProjectUser.project_id == Project.id)
            .where(ProjectUser.user_id == user_id)
        )
    if bgi_ids:
        q = q.where(Project.bgi_id.in_(bgi_ids))
    q = q.group_by(CloudResource.product)

    result = await session.execute(q)
    rows = result.all()

    counts: dict[str, int] = {}
    for product, cnt in rows:
        category = get_category_for_product(product)
        counts[category] = counts.get(category, 0) + cnt
    return counts


async def get_by_id(session: AsyncSession, project_id: str) -> Project | None:
    result = await session.execute(
        select(Project).where(Project.id == project_id).options(*_project_options())
    )
    return result.scalar_one_or_none()


async def create(
    session: AsyncSession, data: ProjectCreate, actor: dict[str, Any]
) -> Project:
    project = Project(
        id=data.id or f"PRJ-{uuid.uuid4().hex[:8].upper()}",
        name=data.name,
        status=data.status,
        description=data.description,
        wave_id=data.wave_id,
    )
    session.add(project)
    await session.flush()
    await audit_service.append_entry(
        session,
        project_id=project.id,
        event_type="project_created",
        entity_type="project",
        actor=actor,
    )
    result = await session.execute(
        select(Project).where(Project.id == project.id).options(*_project_options())
    )
    return result.scalar_one()


async def update(
    session: AsyncSession,
    project: Project,
    patch: ProjectPatch,
    actor: dict[str, Any],
) -> Project:
    changes = []
    for field, value in patch.model_dump(exclude_none=True).items():
        if field == "wave_id" and value:
            await _check_wave_completed(session, value)
        old = getattr(project, field, None)
        if old != value:
            changes.append({"field": field, "label": field, "old_value": old, "new_value": value})
        setattr(project, field, value)

    if changes:
        await audit_service.append_entry(
            session,
            project_id=project.id,
            event_type="status_changed" if "status" in patch.model_fields_set else "section_updated",
            entity_type="project",
            actor=actor,
            changes=changes,
        )

    await session.flush()
    await session.refresh(project)
    return project


def _collect_attachment_ids(obj: Any) -> list[str]:
    """Recursively collect all string values found under 'attachmentIds' keys."""
    ids: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "attachmentIds" and isinstance(v, list):
                ids.extend([str(item) for item in v if isinstance(item, str)])
            else:
                ids.extend(_collect_attachment_ids(v))
    elif isinstance(obj, list):
        for item in obj:
            ids.extend(_collect_attachment_ids(item))
    return ids


def _engagement_to_dict(project: Project) -> dict[str, Any] | None:
    if project.engagement is None:
        return None
    return project.engagement.to_dict()


async def update_section(
    session: AsyncSession,
    project: Project,
    section_key: str,
    value: Any,
    actor: dict[str, Any],
    skip_audit: bool = False,
) -> Project:
    column = SECTION_COLUMN_MAP.get(section_key)

    if column is None:
        # Delegate to relational table handlers
        if section_key == "currentInfrastructure":
            await _replace_resources(session, project, value, actor)
        elif section_key == "risks":
            await _replace_risks(session, project, value, actor)
        elif section_key == "approvals":
            await _replace_approvals(session, project, value, actor)
        elif section_key == "engagement":
            await _replace_engagement(session, project, value, actor)
    else:
        if section_key == "waveId" and value:
            await _check_wave_completed(session, value)
        if section_key == "dataMigrationPlan" and isinstance(value, dict):
            value = {
                **value,
                "adjustedAt": datetime.now(timezone.utc).isoformat(),
                "adjustedBy": actor.get("id"),
            }
        old = getattr(project, column, None)
        # Merge dict values for JSONB columns so PATCH only updates provided keys.
        # Data migration schedule and environment provision are replaced wholesale
        # because fields/environments can be intentionally cleared by the client.
        if isinstance(old, dict) and isinstance(value, dict) and section_key not in SECTION_REPLACE_WHOLESALE:
            merged = {**old, **value}
            setattr(project, column, merged)
            changes = _diff_section(old, merged)
        else:
            setattr(project, column, value)
            changes = _diff_section(old, value)
        if changes and not skip_audit:
            await audit_service.append_entry(
                session,
                project_id=project.id,
                event_type="section_updated",
                entity_type="section",
                actor=actor,
                section_key=section_key,
                section_label=SECTION_LABELS.get(section_key, section_key),
                changes=changes,
                old_snapshot=old if isinstance(old, dict) else None,
            )

        # Confirm any attachment IDs referenced in the saved section data
        attachment_ids = _collect_attachment_ids(value)
        if attachment_ids:
            await attachment_service.confirm_attachments(
                session, project.id, attachment_ids
            )

    await session.flush()
    await session.refresh(project)

    if section_key in ("currentInfrastructure", "approvals", "applicationOverview"):
        await _derive_and_store_status(session, project)
        await session.flush()

    return project


async def mark_data_migration_complete(
    session: AsyncSession,
    project: Project,
    remark: str | None,
    actor: dict[str, Any],
) -> Project:
    plan = dict(project.data_migration_plan or {})
    completed_at = datetime.now(timezone.utc).isoformat()
    plan["completedAt"] = completed_at
    plan["completedBy"] = actor.get("id")
    if remark is not None:
        plan["completionRemark"] = remark
    project.data_migration_plan = plan
    await session.flush()
    await session.refresh(project)
    await audit_service.append_entry(
        session,
        project_id=project.id,
        event_type="data_migration_completed",
        entity_type="data_migration",
        actor=actor,
        changes=[{"field": "dataMigrationPlan.completedAt", "new": completed_at}],
    )
    return project


async def mark_data_migration_reopen(
    session: AsyncSession,
    project: Project,
    reason: str,
    actor: dict[str, Any],
) -> Project:
    plan = dict(project.data_migration_plan or {})
    reopened_at = datetime.now(timezone.utc).isoformat()
    plan["reopenedAt"] = reopened_at
    plan["reopenedBy"] = actor.get("id")
    plan["reopenReason"] = reason
    # Clear completion fields so the plan can be edited again.
    plan.pop("completedAt", None)
    plan.pop("completedBy", None)
    plan.pop("completionRemark", None)
    project.data_migration_plan = plan
    await session.flush()
    await session.refresh(project)
    await audit_service.append_entry(
        session,
        project_id=project.id,
        event_type="data_migration_reopened",
        entity_type="data_migration",
        actor=actor,
        changes=[
            {"field": "dataMigrationPlan.reopenedAt", "new": reopened_at},
            {"field": "dataMigrationPlan.reopenReason", "new": reason},
        ],
    )
    return project


async def _replace_resources(
    session: AsyncSession, project: Project, value: Any, actor: dict[str, Any]
) -> None:
    resources = value.get("resources", []) if isinstance(value, dict) else []
    # Snapshot old resources BEFORE deletion so we can diff them
    old_resources = list(project.cloud_resources)
    resource_events = _classify_resource_changes(old_resources, resources)
    # Delete existing
    for r in old_resources:
        await session.delete(r)
    await session.flush()
    # Insert new
    for r_data in resources:
        resource = CloudResource(
            resource_id=r_data.get("resourceId"),
            project_id=project.id,
            name=r_data.get("name", ""),
            product=r_data.get("product"),
            resource_set=r_data.get("resourceSet"),
            specs=r_data.get("specs"),
            sub_application=r_data.get("subApplication"),
            target_resource_id=r_data.get("targetResourceId"),
            sync_status=r_data.get("syncStatus", "out-of-sync"),
            need_migration=r_data.get("needMigration", True),
            migration_completed=r_data.get("migrationCompleted", False),
            jira_subtask_key=r_data.get("jiraSubtaskKey"),
        )
        session.add(resource)
        project.cloud_resources.append(resource)
    for rid, entity_label, resource_changes, is_sync_complete, action in resource_events:
        if action == "added":
            event_type = "resource_added"
        elif action == "removed":
            event_type = "resource_removed"
        elif is_sync_complete:
            event_type = "resource_sync_completed"
        else:
            event_type = "resource_updated"
        if resource_changes or action in ("added", "removed"):
            await audit_service.append_entry(
                session, project_id=project.id,
                event_type=event_type,
                entity_type="resource",
                actor=actor,
                entity_id=rid,
                entity_label=entity_label,
                changes=resource_changes,
            )


async def _replace_risks(
    session: AsyncSession, project: Project, value: Any, actor: dict[str, Any]
) -> None:
    risks_data = value if isinstance(value, list) else []
    for r in list(project.risks):
        await session.delete(r)
    await session.flush()
    for r_data in risks_data:
        risk = Risk(
            id=r_data.get("id") or str(uuid.uuid4()),
            project_id=project.id,
            title=r_data.get("title", ""),
            description=r_data.get("description", ""),
            severity=r_data.get("severity", "medium"),
            mitigation=r_data.get("mitigation"),
            owner=r_data.get("owner"),
            risk_status=r_data.get("riskStatus"),
        )
        session.add(risk)
        project.risks.append(risk)
    await audit_service.append_entry(
        session,
        project_id=project.id,
        event_type="risks_updated",
        entity_type="risks",
        actor=actor,
        changes=[],
    )


def _validate_approval_sequence(approvals_data: list[dict]) -> None:
    """Raise ValueError if any role is approved while its predecessor is not."""
    seq = approval_sequence_for_project(approvals_data)
    status_map = {a.get("role"): a.get("status", "pending") for a in approvals_data}
    for i, role in enumerate(seq):
        if status_map.get(role) == "approved":
            for predecessor in seq[:i]:
                if status_map.get(predecessor) != "approved":
                    raise ValueError(
                        f"Cannot approve '{role}' before '{predecessor}' has approved."
                    )


async def _check_approval_authority(
    session: AsyncSession, project: Project, role: str, actor_id: str
) -> None:
    """Raise ValueError if actor is not authorized to submit this role's approval."""
    from app.models.project_user import ProjectUser
    if role == "platform_migration_lead":
        user = await session.get(User, actor_id)
        if not user or "platform_migration_lead" not in (user.role or ""):
            raise ValueError("Actor is not a Platform Migration Lead.")
    else:
        pu = await session.get(ProjectUser, (project.id, actor_id))
        if not pu:
            raise ValueError(f"Actor is not authorized to approve as '{role}'.")
        user_roles = {r.strip() for r in (pu.role or "").split(",") if r.strip()}
        if role not in user_roles:
            raise ValueError(f"Actor is not authorized to approve as '{role}'.")


async def update_governance_roles(
    session: AsyncSession,
    project: Project,
    assignments: dict[str, str | None],
    actor: dict[str, Any],
) -> None:
    """Upsert governance roles (technical_lead, business_owner, dba_data_owner,
    gbi_champion, gbi_champion_delegate) into project_users, preserving
    non-governance roles.

    assignments: mapping of role -> user_id or None to clear.
    """
    from app.models.project_user import ProjectUser

    governance_roles = {
        "technical_lead",
        "business_owner",
        "dba_data_owner",
        "gbi_champion",
        "gbi_champion_delegate",
    }
    gbi_exclusivity = {"gbi_champion", "gbi_champion_delegate"}
    governed: dict[str, set[str]] = {}
    for role, uid in assignments.items():
        if uid:
            governed.setdefault(uid, set()).add(role)

    # A user cannot hold both GBI Champion and GBI Champion Delegate.
    for uid, roles in governed.items():
        if len(roles & gbi_exclusivity) > 1:
            raise ValueError(
                "A user cannot hold both GBI Champion and GBI Champion Delegate roles on the same project."
            )

    result = await session.execute(
        select(ProjectUser).where(ProjectUser.project_id == project.id)
    )
    existing_pus = result.scalars().all()
    existing_ids = {pu.user_id for pu in existing_pus}
    changes: list[dict] = []

    for pu in existing_pus:
        current_roles = {r.strip() for r in (pu.role or "").split(",") if r.strip()}
        current_gbi = current_roles & gbi_exclusivity
        user_gov_roles = governed.get(pu.user_id, set())
        assigned_gbi = user_gov_roles & gbi_exclusivity
        if len(current_gbi | assigned_gbi) > 1:
            raise ValueError(
                "A user cannot hold both GBI Champion and GBI Champion Delegate roles on the same project."
            )
        non_governance = current_roles - governance_roles
        if user_gov_roles:
            new_roles = non_governance | user_gov_roles
        else:
            new_roles = non_governance or {"member"}
        new_role_str = ",".join(sorted(new_roles))
        if pu.role != new_role_str:
            old = pu.role
            pu.role = new_role_str
            changes.append(
                {"field": pu.user_id, "label": f"Update {pu.user_id}", "old_value": old, "new_value": new_role_str}
            )

    for uid, roles in governed.items():
        if uid not in existing_ids:
            user = await session.get(User, uid)
            if user is not None:
                role_str = ",".join(sorted(roles))
                session.add(ProjectUser(project_id=project.id, user_id=uid, role=role_str))
                changes.append(
                    {"field": uid, "label": f"Add {uid}", "old_value": None, "new_value": role_str}
                )

    if changes:
        await audit_service.append_entry(
            session,
            project_id=project.id,
            event_type="section_updated",
            entity_type="project",
            actor=actor,
            changes=changes,
        )
    await session.flush()


async def _replace_approvals(
    session: AsyncSession, project: Project, value: Any, actor: dict[str, Any]
) -> None:
    approvals_data = value if isinstance(value, list) else []

    # 1. Enforce sequence order
    _validate_approval_sequence(approvals_data)

    # 2. Enforce actor authority for any newly-approved role
    old_status = {a.role: a.status for a in project.approvals}
    for a_data in approvals_data:
        role = a_data.get("role", "")
        if a_data.get("status") == "approved" and old_status.get(role) != "approved":
            await _check_approval_authority(session, project, role, actor["id"])

    for a in list(project.approvals):
        await session.delete(a)
    await session.flush()
    for a_data in approvals_data:
        approval = Approval(
            id=a_data.get("id") or str(uuid.uuid4()),
            project_id=project.id,
            role=a_data.get("role", ""),
            approver=a_data.get("approver"),
            status=a_data.get("status", "pending"),
            timestamp=a_data.get("timestamp"),
            icon=a_data.get("icon", ""),
            user_id=a_data.get("userId"),
        )
        session.add(approval)
        project.approvals.append(approval)
    await audit_service.append_entry(
        session, project_id=project.id, event_type="approval_submitted",
        entity_type="approval", actor=actor, changes=[],
    )


async def _replace_engagement(
    session: AsyncSession, project: Project, value: Any, actor: dict[str, Any]
) -> None:
    engagement_data = value if isinstance(value, dict) else {}

    engagement = project.engagement
    if engagement is None:
        engagement = Engagement(
            id=str(uuid.uuid4()),
            project_id=project.id,
        )
        session.add(engagement)
        project.engagement = engagement
        old_dict = {}
    else:
        old_dict = engagement.to_dict()

    engagement.status = engagement_data.get("status")
    engagement.interview_subject = engagement_data.get("interviewSubject")
    engagement.planned_slots = engagement_data.get("plannedSlots")
    engagement.participant_ids = engagement_data.get("participantIds")
    engagement.engagement_reviewer_ids = engagement_data.get("engagementReviewerIds")
    engagement.engagement_manager_id = engagement_data.get("engagementManagerId")
    engagement.notes = engagement_data.get("notes")
    engagement.confluence_page_id = engagement_data.get("confluencePageId")
    engagement.confluence_page_url = engagement_data.get("confluencePageUrl")
    engagement.zoom_meeting_url = engagement_data.get("zoomMeetingUrl")
    engagement.zoom_meeting_id = engagement_data.get("zoomMeetingId")

    changes = [c for c in _diff_section(old_dict, engagement_data) if c.get("field") != "notes"]
    if changes:
        await audit_service.append_entry(
            session,
            project_id=project.id,
            event_type="section_updated",
            entity_type="section",
            actor=actor,
            section_key="engagement",
            section_label="Engagement",
            changes=changes,
        )

    attachment_ids = _collect_attachment_ids(engagement_data)
    if attachment_ids:
        await attachment_service.confirm_attachments(session, project.id, attachment_ids)

    await session.flush()


async def batch_update_resource_specs(
    session: AsyncSession, project_id: str, updates: list[dict[str, Any]],
    actor: dict[str, Any] | None = None,
) -> None:
    for upd in updates:
        resource_id = upd.get("resource_id") or upd.get("resourceId") or upd.get("id")
        specs_patch = upd.get("specs", {})
        if not resource_id:
            continue
        resource = await session.get(CloudResource, resource_id)
        if resource and resource.project_id == project_id:
            old_specs = resource.specs or {}
            resource.specs = {**old_specs, **specs_patch}
            resource_changes = _diff_section(old_specs, resource.specs)
            if resource_changes and actor:
                await audit_service.append_entry(
                    session, project_id=project_id,
                    event_type="resource_updated",
                    entity_type="resource",
                    actor=actor,
                    entity_id=resource.resource_id,
                    entity_label=resource.name,
                    changes=resource_changes,
                )
    await session.flush()

async def update_planning(
    session: AsyncSession,
    project: Project,
    planning: dict[str, Any],
    actor: dict[str, Any],
) -> Project:
    project.planning = planning
    attributes.flag_modified(project, "planning")
    await audit_service.append_entry(
        session,
        project_id=project.id,
        event_type="section_updated",
        entity_type="section",
        actor=actor,
        section_key="planning",
        section_label="Planning",
    )
    await session.flush()
    await session.refresh(project)
    return project


async def upsert_resources(
    session: AsyncSession,
    project: Project,
    items: list,
    actor: dict[str, Any],
) -> None:
    """Upsert resources without touching the rest of the project's resource list.

    Items with resource_id present in DB → update only non-null fields on that resource.
    Items with resource_id not in DB → create a new resource.
    Resources absent from items → left untouched.
    """
    from app.schemas.cloud_resource import ResourceUpsertItem  # local to avoid circular

    for item in items:
        if not item.resource_id:
            continue  # resource_id is required
        resource = await session.get(CloudResource, item.resource_id)
        if resource:
            if resource.project_id != project.id:
                continue  # silently skip resources not belonging to this project
            changes = []
            for col, label in _RESOURCE_LABEL_MAP.items():
                new_val = getattr(item, col, None)
                if new_val is not None:
                    old_val = getattr(resource, col)
                    if old_val != new_val:
                        changes.append({
                            "field": col, "label": label,
                            "old_value": old_val, "new_value": new_val,
                        })
                    setattr(resource, col, new_val)
            if item.specs is not None:
                spec_changes = _diff_section(resource.specs or {}, item.specs)
                changes.extend(spec_changes)
                resource.specs = item.specs
                attributes.flag_modified(resource, "specs")
            if changes:
                await audit_service.append_entry(
                    session, project_id=project.id,
                    event_type="resource_updated",
                    entity_type="resource", actor=actor,
                    entity_id=resource.resource_id, entity_label=resource.name,
                    changes=changes,
                )
        else:
            resource = CloudResource(
                resource_id=item.resource_id,
                project_id=project.id,
                name=item.name or "",
                product=item.product,
                resource_set=item.resource_set,
                specs=item.specs,
                sub_application=item.sub_application,
                target_resource_id=item.target_resource_id,
                sync_status=item.sync_status or "out-of-sync",
                need_migration=item.need_migration if item.need_migration is not None else True,
                migration_completed=item.migration_completed or False,
                jira_subtask_key=item.jira_subtask_key,
            )
            session.add(resource)
            project.cloud_resources.append(resource)
            await audit_service.append_entry(
                session, project_id=project.id,
                event_type="resource_added",
                entity_type="resource", actor=actor,
                entity_id=resource.resource_id, entity_label=resource.name,
                changes=[],
            )
    await session.flush()


async def update_project_user_roles(
    session: AsyncSession,
    project: Project,
    assignments: list[dict[str, Any]],
    actor: dict[str, Any],
) -> None:
    """Upsert project user roles for a single project.

    Each assignment must contain ``user_id`` and ``roles`` (list of strings).
    An empty ``roles`` list deletes the project_users row. Users not listed
    are left untouched.
    """
    from app.models.project_user import ProjectUser

    result = await session.execute(
        select(ProjectUser).where(ProjectUser.project_id == project.id)
    )
    existing_map = {pu.user_id: pu for pu in result.scalars().all()}
    changes: list[dict] = []

    for a in assignments:
        uid = a.get("user_id")
        roles = a.get("roles", [])
        if not uid:
            continue
        pu = existing_map.get(uid)
        if not roles:
            if pu is not None:
                old = pu.role
                await session.delete(pu)
                changes.append(
                    {"field": uid, "label": f"Remove {uid}", "old_value": old, "new_value": None}
                )
            continue
        new_role_str = ",".join(sorted(roles))
        if pu is None:
            user = await session.get(User, uid)
            if user is not None:
                session.add(
                    ProjectUser(project_id=project.id, user_id=uid, role=new_role_str)
                )
                changes.append(
                    {"field": uid, "label": f"Add {uid}", "old_value": None, "new_value": new_role_str}
                )
        elif pu.role != new_role_str:
            old = pu.role
            pu.role = new_role_str
            changes.append(
                {"field": uid, "label": f"Update {uid}", "old_value": old, "new_value": new_role_str}
            )

    if changes:
        await audit_service.append_entry(
            session,
            project_id=project.id,
            event_type="section_updated",
            entity_type="project",
            actor=actor,
            changes=changes,
        )
    await session.flush()


async def delete_resources_by_ids(
    session: AsyncSession,
    project: Project,
    resource_ids: list[str],
    actor: dict[str, Any],
) -> int:
    """Delete project resources by resource_id list. Returns count of deleted resources.

    IDs not found in the project are silently skipped.
    """
    deleted = 0
    for rid in resource_ids:
        resource = await session.get(CloudResource, rid)
        if resource and resource.project_id == project.id:
            label = resource.name
            await session.delete(resource)
            await audit_service.append_entry(
                session, project_id=project.id,
                event_type="resource_removed",
                entity_type="resource", actor=actor,
                entity_id=rid, entity_label=label,
                changes=[],
            )
            deleted += 1
    await session.flush()
    return deleted


async def reset_project(
    session: AsyncSession,
    project: Project,
    actor: dict[str, Any],
) -> Project:
    """Reset a project, preserving application overview, team, resources, and attachments.

    Clears: availability, data_persistence, dependencies, nfrs, migration_constraints,
    target_architecture, migration_effort_estimation, jira_subtask_config, planning,
    survey_submitted_at, blocked_reason, jira_story_key, jira_job_status, risks, approvals.
    Resets status to 'planning'.
    Also clears the project's full audit history and records a single `project_reset` event.
    """
    changes: list[dict] = []

    section_labels = {
        "availability": "Availability & Resilience",
        "data_persistence": "Data & Persistence",
        "dependencies": "Dependencies",
        "nfrs": "Non-Functional Requirements",
        "migration_constraints": "Migration Constraints",
        "target_architecture": "Target Architecture",
        "migration_effort_estimation": "Migration Effort Estimation",
        "jira_subtask_config": "Jira Subtask Config",
    }

    for col, label in section_labels.items():
        old = getattr(project, col, None)
        if old is not None:
            changes.append({"field": col, "label": label, "old_value": old, "new_value": None})
        setattr(project, col, None)

    if project.blocked_reason is not None:
        changes.append({"field": "blocked_reason", "label": "Blocked Reason", "old_value": project.blocked_reason, "new_value": None})
        project.blocked_reason = None

    if project.survey_submitted_at is not None:
        changes.append({"field": "survey_submitted_at", "label": "Survey Submitted At", "old_value": project.survey_submitted_at.isoformat() if project.survey_submitted_at else None, "new_value": None})
        project.survey_submitted_at = None

    if project.data_migration_schedule is not None:
        changes.append({"field": "data_migration_schedule", "label": "Data Migration Schedule", "old_value": project.data_migration_schedule, "new_value": None})
        project.data_migration_schedule = None

    if project.data_migration_plan is not None:
        changes.append({"field": "data_migration_plan", "label": "Data Migration Plan", "old_value": project.data_migration_plan, "new_value": None})
        project.data_migration_plan = None

    if project.data_migration_survey_submitted_at is not None:
        changes.append({"field": "data_migration_survey_submitted_at", "label": "Data Migration Survey Submitted At", "old_value": project.data_migration_survey_submitted_at.isoformat() if project.data_migration_survey_submitted_at else None, "new_value": None})
        project.data_migration_survey_submitted_at = None

    if project.planning is not None:
        changes.append({"field": "planning", "label": "Planning", "old_value": project.planning, "new_value": None})
        project.planning = None
        attributes.flag_modified(project, "planning")

    if project.jira_story_key is not None:
        changes.append({"field": "jira_story_key", "label": "Jira Story Key", "old_value": project.jira_story_key, "new_value": None})
        project.jira_story_key = None

    if project.jira_job_status is not None:
        changes.append({"field": "jira_job_status", "label": "Jira Job Status", "old_value": project.jira_job_status, "new_value": None})
        project.jira_job_status = None

    risk_count = len(project.risks or [])
    for risk in list(project.risks or []):
        await session.delete(risk)
    if risk_count:
        changes.append({"field": "risks", "label": "Risks", "old_value": f"{risk_count} risk(s)", "new_value": None})

    approval_count = len(project.approvals or [])
    for approval in list(project.approvals or []):
        await session.delete(approval)
    if approval_count:
        changes.append({"field": "approvals", "label": "Approvals", "old_value": f"{approval_count} approval(s)", "new_value": None})

    old_status = project.status
    if old_status != "planning":
        changes.append({"field": "status", "label": "Status", "old_value": old_status, "new_value": "planning"})
    project.status = "planning"

    # Wipe the project's audit history, then record the reset itself
    await audit_service.clear_by_project(session, project.id)

    await audit_service.append_entry(
        session,
        project_id=project.id,
        event_type="project_reset",
        entity_type="project",
        actor=actor,
        changes=changes,
    )

    await session.flush()
    await session.refresh(project)
    return project


async def _check_wave_completed(session: AsyncSession, wave_id: str | None) -> None:
    if not wave_id:
        return
    from app.services import wave_service
    wave = await wave_service.get_by_id(session, wave_id)
    if wave and wave.status == "completed":
        raise ValueError(f"Assignment to completed wave '{wave.name}' is blocked.")


# ─── Survey Drafts ───────────────────────────────────────────────────────────


async def get_survey_draft(
    session: AsyncSession, user_id: str, project_id: str
) -> SurveyDraft | None:
    result = await session.execute(
        select(SurveyDraft).where(
            SurveyDraft.user_id == user_id,
            SurveyDraft.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def save_survey_draft(
    session: AsyncSession,
    user_id: str,
    project_id: str,
    payload: dict[str, Any],
) -> SurveyDraft:
    draft = await get_survey_draft(session, user_id, project_id)
    if draft is not None:
        draft.payload = payload
    else:
        draft = SurveyDraft(
            id=f"sd-{uuid.uuid4().hex[:8]}",
            user_id=user_id,
            project_id=project_id,
            payload=payload,
        )
        session.add(draft)
    await session.flush()
    await session.refresh(draft)
    return draft


async def delete_survey_draft(
    session: AsyncSession, user_id: str, project_id: str
) -> None:
    draft = await get_survey_draft(session, user_id, project_id)
    if draft is not None:
        await session.delete(draft)
        await session.flush()


async def get_survey_draft_project_ids(
    session: AsyncSession,
) -> list[str]:
    """Return distinct project IDs that have any survey draft."""
    result = await session.execute(
        select(SurveyDraft.project_id).distinct()
    )
    return [row[0] for row in result.all() if row[0]]
