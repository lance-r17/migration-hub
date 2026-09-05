"""MCP Dashboard tools: stats, activity, risk register, Jira status, migration settings."""

import logging
from typing import Any

from sqlalchemy import select

from app.mcp.context import McpContext
from app.mcp.registry import register_tool
from app.models.project import Project
from app.models.risk import Risk
from app.models.wave import Wave
from app.services import dashboard_service, migration_settings_service

logger = logging.getLogger(__name__)


@register_tool(
    name="get_overall_stats",
    description="Get overall migration statistics: average progress, total assets, completed and in-progress project counts.",
    input_schema={"type": "object", "properties": {}},
)
async def get_overall_stats(args: dict, ctx: McpContext) -> dict:
    stats = await dashboard_service.compute_stats(ctx.db)
    return {
        "progress": stats.progress,
        "total_assets": stats.total_assets,
        "target_cloud": stats.target_cloud,
        "completed": stats.completed,
        "in_progress": stats.in_progress,
    }


@register_tool(
    name="get_recent_activity",
    description="Get recent audit log activity for situational awareness.",
    input_schema={
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Number of activity entries to return", "default": 50},
        },
    },
)
async def get_recent_activity(args: dict, ctx: McpContext) -> list[dict]:
    limit = args.get("limit", 50)
    activities = await dashboard_service.get_recent_activity(ctx.db, limit=limit)
    return [
        {
            "id": a.id,
            "type": a.type,
            "message": a.message,
            "time": a.time,
            "actor": a.actor,
            "project_id": a.project_id,
            "project_name": a.project_name,
        }
        for a in activities
    ]


@register_tool(
    name="get_risk_register",
    description="Get a flattened risk register with project and wave context. Optionally filter by wave, severity, or status.",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Filter by wave ID (optional)"},
            "severity": {"type": "string", "description": "Filter by severity: low, medium, critical (optional)"},
            "status": {"type": "string", "description": "Filter by risk status (optional)"},
        },
    },
)
async def get_risk_register(args: dict, ctx: McpContext) -> list[dict]:
    q = select(Project, Risk).join(Risk, Risk.project_id == Project.id)
    if args.get("wave_id"):
        q = q.where(Project.wave_id == args["wave_id"])
    if args.get("severity"):
        q = q.where(Risk.severity == args["severity"])
    if args.get("status"):
        q = q.where(Risk.risk_status == args["status"])
    else:
        # Default to open risks only
        q = q.where(Risk.risk_status != "resolved")

    result = await ctx.db.execute(q.order_by(Risk.severity, Project.name))
    rows = result.all()

    return [
        {
            "risk_id": risk.id,
            "title": risk.title,
            "description": risk.description,
            "severity": risk.severity,
            "mitigation": risk.mitigation,
            "owner": risk.owner,
            "risk_status": risk.risk_status,
            "project_id": project.id,
            "project_name": project.name,
            "wave_id": project.wave_id,
        }
        for project, risk in rows
    ]


@register_tool(
    name="get_jira_execution_status",
    description="Get Jira execution status for projects. Returns story/subtask keys, job status, and completion rates.",
    input_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "Filter by project ID (optional)"},
            "wave_id": {"type": "string", "description": "Filter by wave ID (optional)"},
        },
    },
)
async def get_jira_execution_status(args: dict, ctx: McpContext) -> list[dict]:
    q = select(Project)
    if args.get("project_id"):
        q = q.where(Project.id == args["project_id"])
    if args.get("wave_id"):
        q = q.where(Project.wave_id == args["wave_id"])

    from sqlalchemy.orm import selectinload

    result = await ctx.db.execute(q.order_by(Project.name).options(selectinload(Project.cloud_resources)))
    projects = list(result.scalars().all())

    return [
        {
            "project_id": p.id,
            "project_name": p.name,
            "jira_story_key": p.jira_story_key,
            "jira_job_status": p.jira_job_status,
            "wave_id": p.wave_id,
            "resource_count": len(p.cloud_resources or []),
            "resources_with_subtask": sum(1 for r in (p.cloud_resources or []) if r.jira_subtask_key),
        }
        for p in projects
    ]


@register_tool(
    name="get_migration_settings",
    description="Get migration platform settings including platform period, cloud setup period, and duration options.",
    input_schema={"type": "object", "properties": {}},
)
async def get_migration_settings(args: dict, ctx: McpContext) -> dict:
    settings = await migration_settings_service.get_migration_settings(ctx.db)
    return {
        "platform_period": (
            {"start_date": settings.platform_period.start_date, "end_date": settings.platform_period.end_date}
            if settings.platform_period else None
        ),
        "new_cloud_setup_period": (
            {"start_date": settings.new_cloud_setup_period.start_date, "end_date": settings.new_cloud_setup_period.end_date}
            if settings.new_cloud_setup_period else None
        ),
        "duration_options": settings.duration_options,
        "data_migration_adjustment_enabled": settings.data_migration_adjustment_enabled,
        "create_jira_stories_on_signoff": settings.create_jira_stories_on_signoff,
        "signoff_enabled": settings.signoff_enabled,
        "progress_weights": settings.progress_weights.model_dump(),
    }
