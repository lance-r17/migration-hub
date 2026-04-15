from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLogEntry
from app.models.cloud_resource import CloudResource
from app.models.project import Project
from app.schemas.dashboard import ActivityOut, OverallStatsOut


async def compute_stats(session: AsyncSession) -> OverallStatsOut:
    total_result = await session.execute(select(func.count()).select_from(Project))
    total = total_result.scalar() or 0

    completed_result = await session.execute(
        select(func.count()).select_from(Project).where(Project.status == "completed")
    )
    completed = completed_result.scalar() or 0

    in_progress_result = await session.execute(
        select(func.count()).select_from(Project).where(
            Project.status.in_(["in-progress", "migrating"])
        )
    )
    in_progress = in_progress_result.scalar() or 0

    avg_result = await session.execute(select(func.avg(Project.progress)).select_from(Project))
    avg_progress = float(avg_result.scalar() or 0)

    assets_result = await session.execute(select(func.count()).select_from(CloudResource))
    total_assets = assets_result.scalar() or 0

    return OverallStatsOut(
        progress=round(avg_progress),
        total_assets=total_assets,
        target_cloud="Multi-Region",
        completed=completed,
        in_progress=in_progress,
    )


async def get_recent_activity(
    session: AsyncSession, limit: int = 20
) -> list[ActivityOut]:
    result = await session.execute(
        select(AuditLogEntry)
        .order_by(AuditLogEntry.timestamp.desc())
        .limit(limit)
    )
    entries = list(result.scalars().all())
    activities = []
    for i, entry in enumerate(entries):
        actor = entry.actor or {}
        activities.append(ActivityOut(
            id=entry.id,
            type="info",
            message=f"{entry.event_type.replace('_', ' ').title()} — {entry.entity_label or entry.entity_type}",
            time=entry.timestamp.isoformat() if entry.timestamp else "",
            actor=actor.get("name", "System"),
            project_id=entry.project_id,
        ))
    return activities
