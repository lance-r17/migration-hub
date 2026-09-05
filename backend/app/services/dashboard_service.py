from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLogEntry
from app.models.cloud_resource import CloudResource
from app.models.project import Project
from app.schemas.dashboard import ActivityOut, OverallStatsOut
from app.services import project_service


async def compute_stats(session: AsyncSession) -> OverallStatsOut:
    completed_result = await session.execute(
        select(func.count()).select_from(Project).where(Project.status == "completed")
    )
    completed = completed_result.scalar() or 0

    in_progress_result = await session.execute(
        select(func.count()).select_from(Project).where(
            Project.status.in_(["in-progress", "migrating", "signed-off"])
        )
    )
    in_progress = in_progress_result.scalar() or 0

    # Compute average progress from stage data (not a stored column)
    # Use lightweight loader that skips wave / project_users / risks
    projects = await project_service.get_all_for_stats(session)
    weights, signoff_enabled = await project_service.get_progress_context(session)
    if projects:
        avg_progress = sum(
            project_service.compute_stage_progress(p, weights, signoff_enabled)["overall"] for p in projects
        ) / len(projects)
    else:
        avg_progress = 0.0

    assets_result = await session.execute(select(func.count()).select_from(CloudResource))
    total_assets = assets_result.scalar() or 0

    return OverallStatsOut(
        progress=round(avg_progress),
        total_assets=total_assets,
        target_cloud="3-AZ Cloud Environment",
        completed=completed,
        in_progress=in_progress,
    )


def _fmt_value(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, list):
        joined = ", ".join(str(i) for i in v)
        return joined if len(joined) <= 60 else joined[:60] + "…"
    s = str(v)
    return s if len(s) <= 60 else s[:60] + "…"


def _format_changes(changes: list[dict]) -> str:
    if not changes:
        return ""
    parts = []
    for c in changes:
        label = c.get("label", c.get("field", "field"))
        old = _fmt_value(c.get("old_value"))
        new = _fmt_value(c.get("new_value"))
        if not old and new:
            parts.append(f"{label} set to {new}")
        elif old and not new:
            parts.append(f"{label} cleared (was {old})")
        else:
            parts.append(f"{label} changed from {old} → {new}")
    return ", ".join(parts)


def _build_activity_message(entry: AuditLogEntry, project_name: str | None) -> tuple[str, str]:
    actor = entry.actor.get("name", "System") if entry.actor else "System"
    project = project_name or entry.project_id or "Unknown"
    changes = _format_changes(entry.changes or [])
    changes_suffix = f": {changes}" if changes else ""
    event_type = entry.event_type

    if event_type == "section_updated":
        section = entry.section_label or entry.section_key or "section"
        return f"{actor} updated {section} in {project}{changes_suffix}", "info"

    if event_type == "status_changed":
        status_change = next((c for c in (entry.changes or []) if c.get("field") == "status"), None)
        detail = f": {_fmt_value(status_change.get('old_value'))} → {_fmt_value(status_change.get('new_value'))}" if status_change else changes_suffix
        return f"{actor} changed project status in {project}{detail}", "info"

    if event_type == "approval_submitted":
        approval = entry.entity_label or "approval"
        return f"{actor} approved {approval} in {project}", "success"

    if event_type == "risk_created":
        risk = entry.entity_label or "a new risk"
        sev = next((c for c in (entry.changes or []) if c.get("field") == "severity"), None)
        sev_suffix = f" ({_fmt_value(sev.get('new_value'))})" if sev else ""
        return f"{actor} created risk '{risk}'{sev_suffix} in {project}", "error"

    if event_type == "risk_updated":
        risk = entry.entity_label or "risk"
        return f"{actor} updated risk '{risk}' in {project}{changes_suffix}", "info"

    if event_type == "risk_deleted":
        risk = entry.entity_label or "risk"
        return f"{actor} removed risk '{risk}' from {project}", "error"

    if event_type == "resource_updated":
        resource = entry.entity_label or entry.entity_id or "resource"
        return f"{actor} updated {resource} in {project}{changes_suffix}", "info"

    if event_type == "resource_sync_completed":
        resource = entry.entity_label or entry.entity_id or "resource"
        return f"{actor} completed sync for {resource} in {project}", "success"

    if event_type == "wave_assigned":
        wave = entry.entity_label or entry.entity_id or "wave"
        return f"{wave} assigned to {project}", "info"

    if event_type == "wave_created":
        wave = entry.entity_label or entry.entity_id or "Wave"
        return f"{wave} created", "info"

    if event_type == "wave_imported":
        wave = entry.entity_label or entry.entity_id or "Wave"
        return f"{wave} imported", "info"

    if event_type == "jira_story_created":
        story = entry.entity_label or entry.entity_id or "Jira story"
        return f"{story} created for {project}", "success"

    if event_type == "survey_submitted":
        return f"Survey submitted for {project}", "success"

    return f"{actor} performed {event_type} in {project}", "info"


async def get_recent_activity(
    session: AsyncSession, limit: int = 50
) -> list[ActivityOut]:
    result = await session.execute(
        select(AuditLogEntry)
        .order_by(AuditLogEntry.timestamp.desc())
        .limit(limit)
    )
    entries = list(result.scalars().all())

    # Fetch project names
    project_ids = {e.project_id for e in entries if e.project_id}
    project_map = {}
    if project_ids:
        proj_result = await session.execute(
            select(Project.id, Project.name).where(Project.id.in_(project_ids))
        )
        project_map = {pid: name for pid, name in proj_result.all()}

    activities = []
    for entry in entries:
        actor = entry.actor or {}
        message, activity_type = _build_activity_message(entry, project_map.get(entry.project_id))
        activities.append(ActivityOut(
            id=entry.id,
            type=activity_type,
            message=message,
            time=entry.timestamp.isoformat() if entry.timestamp else "",
            actor=actor.get("name", "System"),
            project_id=entry.project_id,
            project_name=project_map.get(entry.project_id),
        ))
    return activities
