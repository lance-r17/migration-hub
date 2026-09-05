"""Backend port of the milestone-duration math in frontend/src/lib/milestones.ts.

Used by compute_stage_progress so the migration stage percentage is identical to
the wave Gantt chart "%" column and the project details stepper migration step.

Note: row *ordering* (milestoneRowOrder) is intentionally not ported — it has no
effect on duration stats, which are order-independent.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.models.project import Project


def _parse_day(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def milestone_duration_days(start: Any, end: Any) -> int:
    """Duration in days, matching the Gantt chart's formatDuration rule.
    End dates are inclusive: 8 Jun → 15 Jun spans 8 calendar days.
    Unparseable dates contribute a single day (defensive; inputs are validated)."""
    a, b = _parse_day(start), _parse_day(end)
    if not a or not b:
        return 1
    return max(1, (b - a).days + 1)


def _normalize_environment_provision(raw: Any) -> dict[str, dict[str, Any]] | None:
    """Mirror of normalizeEnvironmentProvision in frontend/src/services/projects.ts."""
    if not isinstance(raw, dict):
        return None
    if not any(k in raw for k in ("dev", "prod", "environments", "date")):
        return None
    if "dev" in raw or "prod" in raw:
        result = {env: raw[env] for env in ("dev", "prod") if raw.get(env)}
        return result or None
    result: dict[str, dict[str, Any]] = {}
    for env in raw.get("environments") or []:
        if env not in ("dev", "prod"):
            continue
        result[env] = {"date": raw.get("date"), "completedAt": raw.get("completedAt")}
    return result or None


def build_environment_provision_milestones(project: "Project") -> list[dict[str, Any]]:
    provision = _normalize_environment_provision(project.environment_provision)
    if not provision:
        return []

    today = date.today().isoformat()
    result = []
    for env in ("dev", "prod"):
        entry = provision.get(env)
        if not entry or not entry.get("date"):
            continue
        if entry.get("completedAt"):
            status = "done"
        elif entry["date"] <= today:
            status = "in-progress"
        else:
            status = "todo"
        result.append({
            "id": f"env-provision-date-{project.id}-{env}",
            "start": entry["date"],
            "end": entry["date"],
            "status": status,
        })
    return result


def build_data_migration_period_milestone(project: "Project") -> dict[str, Any] | None:
    plan = project.data_migration_plan or project.data_migration_schedule
    if not isinstance(plan, dict):
        return None

    candidates: list[tuple[Any, Any]] = []
    if plan.get("startDate"):
        candidates.append((plan.get("startDate"), plan.get("endDate")))
    for block in plan.get("cycleBlocks") or []:
        if isinstance(block, dict):
            candidates.append((block.get("startDate"), block.get("endDate")))
    if not candidates:
        return None

    start: str | None = None
    end: str | None = None
    for c_start, c_end in candidates:
        if c_start and (not start or c_start < start):
            start = c_start
        if c_end and (not end or c_end > end):
            end = c_end
    if not start or not end:
        return None

    today = date.today().isoformat()
    if plan.get("completedAt"):
        status = "done"
    elif start <= today <= end:
        status = "in-progress"
    else:
        status = "todo"

    return {
        "id": f"data-migration-period-{project.id}",
        "start": start,
        "end": end,
        "status": status,
    }


def _category_milestone_rows(project: "Project") -> list[dict[str, Any]]:
    plan = project.planning if isinstance(project.planning, dict) else {}
    overrides = plan.get("categoryMilestoneOverrides") or {}
    assigned = sorted(
        project.category_milestones or [],
        key=lambda cm: cm.created_at or datetime.min,
    )
    rows = []
    for cm in assigned:
        override = overrides.get(cm.id) or {}
        rows.append({
            "id": f"category-milestone-{project.id}-{cm.id}",
            "start": override.get("start") or cm.start_date,
            "end": override.get("end") or cm.end_date,
            "status": override.get("status") or "todo",
        })
    return rows


def get_milestone_rows(project: "Project") -> list[dict[str, Any]]:
    """Effective milestone rows for stats: category milestones (with overrides),
    env-provision, data-migration period, and persisted planning milestones."""
    plan = project.planning if isinstance(project.planning, dict) else {}
    assigned_cm_ids = {cm.id for cm in (project.category_milestones or [])}

    persisted = []
    for m in plan.get("milestones") or []:
        if not isinstance(m, dict) or m.get("id") in assigned_cm_ids:
            continue
        persisted.append({
            "id": m.get("id"),
            "start": m.get("start"),
            "end": m.get("end"),
            "status": m.get("status") or "todo",
        })

    rows = build_environment_provision_milestones(project)
    dm_period = build_data_migration_period_milestone(project)
    if dm_period:
        rows.append(dm_period)
    rows.extend(persisted)
    return _category_milestone_rows(project) + rows


def project_milestone_duration_stats(project: "Project") -> tuple[int, int] | None:
    """(total, done) milestone-duration days for a project; None if no rows."""
    rows = get_milestone_rows(project)
    if not rows:
        return None
    total = 0
    done = 0
    for row in rows:
        dur = milestone_duration_days(row["start"], row["end"])
        total += dur
        if row["status"] == "done":
            done += dur
    return total, done
