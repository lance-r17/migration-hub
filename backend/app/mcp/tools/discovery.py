"""MCP Discovery tools: search projects, waves, embargos, users."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.mcp.context import McpContext
from app.mcp.registry import register_tool
from app.models.cloud_resource import CloudResource
from app.models.project import Project
from app.models.wave import Wave
from app.schemas.project import ProjectDetail, ProjectListItem
from app.schemas.wave import WaveOut
from app.services import embargo_service, project_service, user_service, wave_service

logger = logging.getLogger(__name__)


def _project_to_list_item(p: Project) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "status": p.status,
        "blocked_reason": p.blocked_reason,
        "description": p.description,
        "migration_wave": p.migration_wave,
        "wave_id": p.wave_id,
        "jira_story_key": p.jira_story_key,
        "jira_job_status": p.jira_job_status,
        "survey_submitted_at": p.survey_submitted_at.isoformat() if p.survey_submitted_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _project_to_detail(p: Project, progress_ctx=None) -> dict[str, Any]:
    weights, signoff_enabled = progress_ctx if progress_ctx else (None, True)
    stage_progress = project_service.compute_stage_progress(p, weights, signoff_enabled)
    return {
        "id": p.id,
        "name": p.name,
        "status": p.status,
        "blocked_reason": p.blocked_reason,
        "progress": stage_progress.get("overall", 0),
        "description": p.description,
        "migration_wave": p.migration_wave,
        "wave_id": p.wave_id,
        "jira_story_key": p.jira_story_key,
        "jira_job_status": p.jira_job_status,
        "planning": p.planning,
        "survey_submitted_at": p.survey_submitted_at.isoformat() if p.survey_submitted_at else None,
        "stage_progress": stage_progress,
        "application_overview": p.application_overview,
        "availability": p.availability,
        "data_persistence": p.data_persistence,
        "dependencies": p.dependencies,
        "nfrs": p.nfrs,
        "migration_constraints": p.migration_constraints,
        "target_architecture": p.target_architecture,
        "migration_effort_estimation": p.migration_effort_estimation,
        "jira_subtask_config": p.jira_subtask_config,
        "cloud_resources": [
            {
                "resource_id": r.resource_id,
                "name": r.name,
                "product": r.product,
                "resource_set": r.resource_set,
                "sync_status": r.sync_status,
                "need_migration": r.need_migration,
                "migration_completed": r.migration_completed,
                "target_resource_id": r.target_resource_id,
            }
            for r in (p.cloud_resources or [])
        ],
        "risks": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "severity": r.severity,
                "mitigation": r.mitigation,
                "owner": r.owner,
                "risk_status": r.risk_status,
            }
            for r in (p.risks or [])
        ],
        "approvals": [
            {
                "id": a.id,
                "role": a.role,
                "approver": a.approver,
                "status": a.status,
                "timestamp": a.timestamp,
                "user_id": a.user_id,
            }
            for a in (p.approvals or [])
        ],
    }


def _wave_to_dict(w: Wave) -> dict[str, Any]:
    return {
        "id": w.id,
        "name": w.name,
        "start_date": w.start_date,
        "cutover_date": w.cutover_date,
        "description": w.description,
        "jira_project_key": w.jira_project_key,
        "jira_epic_key": w.jira_epic_key,
        "source": w.source,
        "status": w.status,
        "color": w.color,
        "project_order": w.project_order,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


@register_tool(
    name="search_projects",
    description="Search projects by status, wave, progress, BA ID, or unsynced resources. Returns a list of project summaries.",
    input_schema={
        "type": "object",
        "properties": {
            "status": {"type": "string", "description": "Filter by project status (e.g. planning, in-progress, signed-off, migrating, completed, blocked)"},
            "wave_id": {"type": "string", "description": "Filter by wave ID"},
            "min_progress": {"type": "integer", "description": "Minimum overall progress (0-100)"},
            "has_unsynced_resources": {"type": "boolean", "description": "Filter to projects with at least one resource where sync_status != synced"},
            "ba_id": {"type": "string", "description": "Filter by BA ID (matches application_overview->ba_id)"},
            "limit": {"type": "integer", "description": "Maximum number of results to return", "default": 50},
        },
    },
)
async def search_projects(args: dict, ctx: McpContext) -> list[dict]:
    limit = args.get("limit", 50)
    q = select(Project).order_by(Project.name)

    filters = []
    if args.get("status"):
        filters.append(Project.status == args["status"])
    if args.get("wave_id"):
        filters.append(Project.wave_id == args["wave_id"])
    if args.get("ba_id"):
        filters.append(Project.application_overview["ba_id"].as_string() == args["ba_id"])

    if filters:
        q = q.where(*filters)

    result = await ctx.db.execute(q.limit(limit))
    projects = list(result.scalars().all())

    # Post-filter for computed fields
    if args.get("min_progress") is not None:
        min_prog = args["min_progress"]
        for p in projects:
            await ctx.db.refresh(p, ["cloud_resources", "approvals", "project_users", "category_milestones"])
        progress_ctx = await project_service.get_progress_context(ctx.db)
        projects = [p for p in projects if project_service.compute_stage_progress(p, *progress_ctx)["overall"] >= min_prog]

    if args.get("has_unsynced_resources") is True:
        # Need to load resources; simpler to just check in Python for now
        for p in projects:
            await ctx.db.refresh(p, ["cloud_resources"])
        projects = [
            p for p in projects
            if any(r.sync_status != "synced" for r in (p.cloud_resources or []))
        ]

    return [_project_to_list_item(p) for p in projects]


@register_tool(
    name="get_project_detail",
    description="Get full details for a single project including all sections, resources, risks, and approvals.",
    input_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "Project ID"},
        },
        "required": ["project_id"],
    },
)
async def get_project_detail(args: dict, ctx: McpContext) -> dict[str, Any]:
    project = await project_service.get_by_id(ctx.db, args["project_id"])
    if not project:
        return {"error": f"Project {args['project_id']} not found"}
    return _project_to_detail(project, await project_service.get_progress_context(ctx.db))


@register_tool(
    name="list_waves",
    description="List all migration waves with basic metadata and project counts.",
    input_schema={"type": "object", "properties": {}},
)
async def list_waves(args: dict, ctx: McpContext) -> list[dict]:
    from sqlalchemy import func
    waves = await wave_service.get_all(ctx.db)
    # Fetch project counts per wave in one query to avoid N+1 lazy loads
    wave_ids = [w.id for w in waves]
    count_result = await ctx.db.execute(
        select(Project.wave_id, func.count(Project.id))
        .where(Project.wave_id.in_(wave_ids))
        .group_by(Project.wave_id)
    )
    count_map = {wid: cnt for wid, cnt in count_result.all()}
    result = []
    for w in waves:
        wave_dict = _wave_to_dict(w)
        wave_dict["project_count"] = count_map.get(w.id, 0)
        result.append(wave_dict)
    return result


@register_tool(
    name="get_wave_detail",
    description="Get a wave's details plus all projects assigned to it, ordered by project_order if defined.",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Wave ID"},
        },
        "required": ["wave_id"],
    },
)
async def get_wave_detail(args: dict, ctx: McpContext) -> dict[str, Any]:
    wave = await wave_service.get_by_id(ctx.db, args["wave_id"])
    if not wave:
        return {"error": f"Wave {args['wave_id']} not found"}

    # Fetch projects in this wave
    result = await ctx.db.execute(
        select(Project).where(Project.wave_id == wave.id).order_by(Project.name)
    )
    projects = list(result.scalars().all())

    # Apply project_order if present
    if wave.project_order:
        order_map = {pid: idx for idx, pid in enumerate(wave.project_order)}
        projects.sort(key=lambda p: order_map.get(p.id, 9999))

    wave_dict = _wave_to_dict(wave)
    wave_dict["projects"] = [_project_to_list_item(p) for p in projects]
    return wave_dict


@register_tool(
    name="list_embargos",
    description="List change-freeze embargo records. Optionally filter by active date or affected service line.",
    input_schema={
        "type": "object",
        "properties": {
            "active_after": {"type": "string", "description": "Date string (YYYY-MM-DD). Return embargos that end on or after this date."},
            "affected_service_line": {"type": "string", "description": "Filter to embargos affecting this service line"},
        },
    },
)
async def list_embargos(args: dict, ctx: McpContext) -> list[dict]:
    embargos = await embargo_service.get_all(ctx.db)
    result = []
    for e in embargos:
        if args.get("active_after") and e.end_date < args["active_after"]:
            continue
        if args.get("affected_service_line"):
            lines = e.affected_service_lines or []
            if args["affected_service_line"] not in lines:
                continue
        result.append({
            "id": e.id,
            "name": e.name,
            "start_date": e.start_date,
            "end_date": e.end_date,
            "affected_service_lines": e.affected_service_lines or [],
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })
    return result


@register_tool(
    name="list_users",
    description="List users. Optionally filter by project_id to show only users assigned to a specific project.",
    input_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "If provided, return only users assigned to this project"},
        },
    },
)
async def list_users(args: dict, ctx: McpContext) -> list[dict]:
    if args.get("project_id"):
        users = await user_service.get_users_for_project(ctx.db, args["project_id"])
    else:
        users = await user_service.get_all(ctx.db)

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "department": u.department,
            "team": u.team,
            "initials": u.initials,
            "role": u.role,
        }
        for u in users
    ]
