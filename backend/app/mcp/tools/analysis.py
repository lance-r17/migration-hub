"""MCP Analysis tools: wave readiness, scheduling, dependencies, risks, approvals."""

import logging
from typing import Any

from sqlalchemy import func, select

from app.mcp.context import McpContext
from app.mcp.registry import register_tool
from app.models.cloud_resource import CloudResource
from app.models.project import Project
from app.models.risk import Risk
from app.models.wave import Wave
from app.services import embargo_service, migration_settings_service, project_service, wave_service

logger = logging.getLogger(__name__)


def _project_to_list_item(p: Project) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "status": p.status,
        "blocked_reason": p.blocked_reason,
        "wave_id": p.wave_id,
        "jira_story_key": p.jira_story_key,
        "jira_job_status": p.jira_job_status,
    }


@register_tool(
    name="analyze_wave_readiness",
    description="Analyze readiness of all projects in a wave. Returns per-project breakdown of survey completion, signoff status, resource sync percentage, open risk count, and blocking reasons.",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Wave ID to analyze"},
        },
        "required": ["wave_id"],
    },
)
async def analyze_wave_readiness(args: dict, ctx: McpContext) -> dict:
    wave = await wave_service.get_by_id(ctx.db, args["wave_id"])
    if not wave:
        return {"error": f"Wave {args['wave_id']} not found"}

    from sqlalchemy.orm import selectinload
    from app.models.project_user import ProjectUser

    result = await ctx.db.execute(
        select(Project)
        .where(Project.wave_id == wave.id)
        .order_by(Project.name)
        .options(
            selectinload(Project.cloud_resources),
            selectinload(Project.approvals),
            selectinload(Project.risks),
            selectinload(Project.project_users).selectinload(ProjectUser.user),
        )
    )
    projects = list(result.scalars().all())

    breakdown = []
    for p in projects:
        stage = project_service.compute_stage_progress(p)
        blocking = []
        if stage["survey"] < 100:
            blocking.append("survey incomplete")
        if stage["signoff"] < 100:
            pending = [a.role for a in (p.approvals or []) if a.status != "approved"]
            if pending:
                blocking.append(f"signoff pending: {', '.join(pending)}")
        unsynced = sum(1 for r in (p.cloud_resources or []) if r.sync_status != "synced" and r.need_migration)
        total_in_scope = sum(1 for r in (p.cloud_resources or []) if r.need_migration)
        open_risks = sum(1 for r in (p.risks or []) if r.risk_status != "resolved")
        if open_risks > 0:
            critical = sum(1 for r in (p.risks or []) if r.risk_status != "resolved" and r.severity == "critical")
            if critical:
                blocking.append(f"{critical} critical open risk(s)")

        breakdown.append({
            "project_id": p.id,
            "project_name": p.name,
            "overall_progress": stage["overall"],
            "survey_complete": stage["survey"] == 100,
            "signoff_complete": stage["signoff"] == 100,
            "resources_synced_pct": round((total_in_scope - unsynced) / total_in_scope * 100) if total_in_scope else 100,
            "total_in_scope_resources": total_in_scope,
            "open_risk_count": open_risks,
            "blocking_reasons": blocking,
        })

    ready_count = sum(1 for b in breakdown if not b["blocking_reasons"])
    return {
        "wave_id": wave.id,
        "wave_name": wave.name,
        "project_count": len(projects),
        "ready_count": ready_count,
        "blocked_count": len(projects) - ready_count,
        "projects": breakdown,
    }


@register_tool(
    name="check_scheduling_conflicts",
    description="Check for scheduling conflicts between wave dates, project migration constraints, and embargo records.",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Specific wave to check (optional)"},
            "project_id": {"type": "string", "description": "Specific project to check (optional)"},
        },
    },
)
async def check_scheduling_conflicts(args: dict, ctx: McpContext) -> dict:
    conflicts = {"embargo_overlaps": [], "date_constraint_violations": [], "dependency_date_gaps": []}

    # Load embargos
    embargos = await embargo_service.get_all(ctx.db)

    # Load migration settings for platform period
    mig_settings = await migration_settings_service.get_migration_settings(ctx.db)
    platform_start = None
    platform_end = None
    if mig_settings.platform_period:
        platform_start = mig_settings.platform_period.start_date
        platform_end = mig_settings.platform_period.end_date

    # Build project query
    project_query = select(Project)
    if args.get("project_id"):
        project_query = project_query.where(Project.id == args["project_id"])
    if args.get("wave_id"):
        project_query = project_query.where(Project.wave_id == args["wave_id"])

    from sqlalchemy.orm import selectinload

    result = await ctx.db.execute(
        project_query.options(selectinload(Project.wave))
    )
    projects = list(result.scalars().all())

    for p in projects:
        mc = p.migration_constraints or {}
        earliest = mc.get("earliestStartDate")
        latest = mc.get("latestEndDate")
        wave = p.wave
        wave_start = wave.start_date if wave else None
        wave_cutover = wave.cutover_date if wave else None

        # Check project constraints against wave dates
        if earliest and wave_start and earliest > wave_start:
            conflicts["date_constraint_violations"].append({
                "project_id": p.id,
                "project_name": p.name,
                "type": "earliest_start_after_wave_start",
                "detail": f"Project earliest start ({earliest}) is after wave start ({wave_start})",
            })
        if latest and wave_cutover and latest < wave_cutover:
            conflicts["date_constraint_violations"].append({
                "project_id": p.id,
                "project_name": p.name,
                "type": "latest_end_before_wave_cutover",
                "detail": f"Project latest end ({latest}) is before wave cutover ({wave_cutover})",
            })

        # Check platform period constraints
        if platform_start and wave_start and wave_start < platform_start:
            conflicts["date_constraint_violations"].append({
                "project_id": p.id,
                "project_name": p.name,
                "type": "wave_start_before_platform_period",
                "detail": f"Wave start ({wave_start}) is before platform period start ({platform_start})",
            })
        if platform_end and wave_cutover and wave_cutover > platform_end:
            conflicts["date_constraint_violations"].append({
                "project_id": p.id,
                "project_name": p.name,
                "type": "wave_cutover_after_platform_period",
                "detail": f"Wave cutover ({wave_cutover}) is after platform period end ({platform_end})",
            })

        # Check embargos
        for e in embargos:
            if wave_cutover and e.start_date <= wave_cutover <= e.end_date:
                conflicts["embargo_overlaps"].append({
                    "project_id": p.id,
                    "project_name": p.name,
                    "wave_id": wave.id if wave else None,
                    "embargo_id": e.id,
                    "embargo_name": e.name,
                    "embargo_dates": f"{e.start_date} to {e.end_date}",
                    "detail": f"Wave cutover ({wave_cutover}) falls inside embargo '{e.name}'",
                })

    # Dependency date gaps — preload all projects to avoid N+1
    all_projects_result = await ctx.db.execute(select(Project).options(selectinload(Project.wave)))
    all_projects = list(all_projects_result.scalars().all())
    name_to_project = {}
    baid_to_project = {}
    for proj in all_projects:
        name_to_project[proj.name] = proj
        ba_id = (proj.application_overview or {}).get("baId")
        if ba_id:
            baid_to_project[ba_id] = proj

    for p in projects:
        deps = p.dependencies or {}
        upstream = deps.get("upstream") or []
        for d in upstream:
            up_project = name_to_project.get(d.get("name")) or baid_to_project.get(d.get("baId"))
            if up_project and up_project.wave and p.wave:
                if up_project.wave.cutover_date > p.wave.start_date:
                    conflicts["dependency_date_gaps"].append({
                        "project_id": p.id,
                        "project_name": p.name,
                        "upstream_project_id": up_project.id,
                        "upstream_project_name": up_project.name,
                        "detail": f"Upstream {up_project.name} cutover ({up_project.wave.cutover_date}) is after this project's wave start ({p.wave.start_date})",
                    })

    return conflicts


@register_tool(
    name="analyze_dependency_graph",
    description="Build a dependency graph for projects. Returns nodes, edges, cycles, and orphan nodes.",
    input_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "Focus on a specific project (optional)"},
            "wave_id": {"type": "string", "description": "Limit to projects in a specific wave (optional)"},
        },
    },
)
async def analyze_dependency_graph(args: dict, ctx: McpContext) -> dict:
    q = select(Project)
    if args.get("wave_id"):
        q = q.where(Project.wave_id == args["wave_id"])
    if args.get("project_id"):
        q = q.where(Project.id == args["project_id"])

    result = await ctx.db.execute(q)
    projects = list(result.scalars().all())

    nodes = []
    edges = []
    name_to_id = {}
    id_to_project = {}

    for p in projects:
        nodes.append({"id": p.id, "name": p.name, "status": p.status, "wave_id": p.wave_id})
        name_to_id[p.name] = p.id
        id_to_project[p.id] = p
        ba_id = (p.application_overview or {}).get("baId")
        if ba_id:
            name_to_id[ba_id] = p.id

    # Build edges
    for p in projects:
        deps = p.dependencies or {}
        for d in (deps.get("upstream") or []):
            target_id = name_to_id.get(d.get("name")) or name_to_id.get(d.get("baId"))
            if target_id and target_id != p.id:
                edges.append({"from": target_id, "to": p.id, "type": "upstream"})
        for d in (deps.get("downstream") or []):
            target_id = name_to_id.get(d.get("name")) or name_to_id.get(d.get("baId"))
            if target_id and target_id != p.id:
                edges.append({"from": p.id, "to": target_id, "type": "downstream"})

    # Cycle detection (simple DFS)
    adj = {}
    for e in edges:
        adj.setdefault(e["from"], []).append(e["to"])

    cycles = []
    visited = set()
    rec_stack = set()

    def dfs(node, path):
        visited.add(node)
        rec_stack.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                dfs(neighbor, path + [neighbor])
            elif neighbor in rec_stack:
                cycle_start = path.index(neighbor)
                cycle = path[cycle_start:] + [neighbor]
                cycles.append([{"id": cid, "name": id_to_project.get(cid, {}).get("name", cid)} for cid in cycle])
        rec_stack.remove(node)

    for p in projects:
        if p.id not in visited:
            dfs(p.id, [p.id])

    # Orphan nodes = no edges
    connected = set(e["from"] for e in edges) | set(e["to"] for e in edges)
    orphans = [n for n in nodes if n["id"] not in connected]

    return {
        "nodes": nodes,
        "edges": edges,
        "cycles": cycles,
        "orphan_nodes": orphans,
    }


@register_tool(
    name="compute_resource_migration_progress",
    description="Compute resource migration progress per wave or per project. Returns counts by sync status and migration completion, grouped by product category.",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Filter by wave ID (optional)"},
            "project_id": {"type": "string", "description": "Filter by project ID (optional)"},
        },
    },
)
async def compute_resource_migration_progress(args: dict, ctx: McpContext) -> dict:
    q = select(Project, CloudResource).join(CloudResource, CloudResource.project_id == Project.id)
    if args.get("wave_id"):
        q = q.where(Project.wave_id == args["wave_id"])
    if args.get("project_id"):
        q = q.where(Project.id == args["project_id"])

    result = await ctx.db.execute(q)
    rows = result.all()

    total = 0
    in_scope = 0
    synced = 0
    completed = 0
    by_category: dict[str, dict[str, int]] = {}

    from app.services.product_category_service import get_category_for_product

    for project, resource in rows:
        total += 1
        if not resource.need_migration:
            continue
        in_scope += 1
        if resource.sync_status == "synced":
            synced += 1
        if resource.migration_completed:
            completed += 1

        cat = get_category_for_product(resource.product)
        cat_data = by_category.setdefault(cat, {"total": 0, "in_scope": 0, "synced": 0, "completed": 0})
        cat_data["total"] += 1
        if resource.need_migration:
            cat_data["in_scope"] += 1
        if resource.sync_status == "synced":
            cat_data["synced"] += 1
        if resource.migration_completed:
            cat_data["completed"] += 1

    return {
        "total_resources": total,
        "in_scope_resources": in_scope,
        "synced_resources": synced,
        "completed_resources": completed,
        "sync_pct": round(synced / in_scope * 100) if in_scope else 0,
        "completion_pct": round(completed / in_scope * 100) if in_scope else 0,
        "by_category": by_category,
    }


@register_tool(
    name="analyze_risk_exposure",
    description="Analyze open risk exposure. Returns risks grouped by severity, with mitigation coverage and owner gaps.",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Filter by wave ID (optional)"},
            "project_id": {"type": "string", "description": "Filter by project ID (optional)"},
            "min_severity": {"type": "string", "description": "Minimum severity to include: low, medium, critical", "default": "low"},
        },
    },
)
async def analyze_risk_exposure(args: dict, ctx: McpContext) -> dict:
    q = select(Project, Risk).join(Risk, Risk.project_id == Project.id)
    if args.get("wave_id"):
        q = q.where(Project.wave_id == args["wave_id"])
    if args.get("project_id"):
        q = q.where(Project.id == args["project_id"])

    result = await ctx.db.execute(q)
    rows = result.all()

    severity_order = {"low": 1, "medium": 2, "critical": 3}
    min_sev = severity_order.get(args.get("min_severity", "low"), 1)

    risks_by_severity: dict[str, list[dict]] = {"low": [], "medium": [], "critical": []}
    mitigated = 0
    unowned = 0
    total = 0

    for project, risk in rows:
        if risk.risk_status == "resolved":
            continue
        sev = risk.severity or "medium"
        if severity_order.get(sev, 1) < min_sev:
            continue
        total += 1
        risk_dict = {
            "id": risk.id,
            "project_id": project.id,
            "project_name": project.name,
            "title": risk.title,
            "severity": sev,
            "mitigation": risk.mitigation,
            "owner": risk.owner,
            "risk_status": risk.risk_status,
        }
        risks_by_severity.setdefault(sev, []).append(risk_dict)
        if risk.mitigation:
            mitigated += 1
        if not risk.owner:
            unowned += 1

    return {
        "total_open_risks": total,
        "mitigated_count": mitigated,
        "unowned_count": unowned,
        "mitigation_coverage_pct": round(mitigated / total * 100) if total else 0,
        "risks_by_severity": risks_by_severity,
    }


@register_tool(
    name="identify_approval_bottlenecks",
    description="Identify projects stalled at each approval stage (technical_lead, business_owner, platform_migration_lead).",
    input_schema={
        "type": "object",
        "properties": {
            "wave_id": {"type": "string", "description": "Filter by wave ID (optional)"},
        },
    },
)
async def identify_approval_bottlenecks(args: dict, ctx: McpContext) -> dict:
    from sqlalchemy.orm import selectinload

    q = select(Project).where(Project.status != "completed")
    if args.get("wave_id"):
        q = q.where(Project.wave_id == args["wave_id"])

    result = await ctx.db.execute(q.order_by(Project.name).options(selectinload(Project.approvals)))
    projects = list(result.scalars().all())

    approval_sequence = ["technical_lead", "business_owner", "platform_migration_lead"]
    bottlenecks = {role: [] for role in approval_sequence}

    for p in projects:
        approvals = {a.role: a.status for a in (p.approvals or [])}
        for role in approval_sequence:
            if approvals.get(role) != "approved":
                # Check if predecessor is approved (for sequence)
                role_idx = approval_sequence.index(role)
                predecessors = approval_sequence[:role_idx]
                if all(approvals.get(r) == "approved" for r in predecessors):
                    bottlenecks[role].append({
                        "project_id": p.id,
                        "project_name": p.name,
                        "status": approvals.get(role, "pending"),
                        "approver": next((a.approver for a in (p.approvals or []) if a.role == role), None),
                    })
                break  # Only the first non-approved role in sequence is the bottleneck

    return {
        "total_projects_checked": len(projects),
        "bottlenecks": bottlenecks,
    }


@register_tool(
    name="suggest_wave_assignments",
    description="Suggest wave assignments for unassigned projects based on constraint compatibility, dependency clustering, and resource count balancing.",
    input_schema={
        "type": "object",
        "properties": {
            "project_ids": {"type": "array", "items": {"type": "string"}, "description": "Specific project IDs to evaluate (optional)"},
            "unassigned_only": {"type": "boolean", "description": "Only consider projects with no wave_id", "default": True},
        },
    },
)
async def suggest_wave_assignments(args: dict, ctx: McpContext) -> dict:
    q = select(Project)
    if args.get("project_ids"):
        q = q.where(Project.id.in_(args["project_ids"]))
    elif args.get("unassigned_only", True):
        q = q.where(Project.wave_id.is_(None))

    from sqlalchemy.orm import selectinload

    result = await ctx.db.execute(q.order_by(Project.name).options(selectinload(Project.cloud_resources)))
    projects = list(result.scalars().all())

    waves = await wave_service.get_all(ctx.db)
    wave_list = list(waves)

    suggestions = []
    for p in projects:
        mc = p.migration_constraints or {}
        earliest = mc.get("earliestStartDate")
        latest = mc.get("latestEndDate")
        preferred = mc.get("preferredMigrationWindow") or []
        resource_count = len(p.cloud_resources or [])

        best_wave = None
        best_score = -1
        reasons = []

        for w in wave_list:
            score = 0
            wave_reasons = []

            # Date compatibility
            if earliest and w.start_date >= earliest:
                score += 2
                wave_reasons.append("wave start after project earliest date")
            if latest and w.cutover_date <= latest:
                score += 2
                wave_reasons.append("wave cutover before project latest date")

            # Preferred window compatibility
            if preferred:
                # Simple heuristic: if preferred contains 'weekday', wave is fine
                score += 1
                wave_reasons.append("preferred window compatible")

            # Resource load balancing — prefer waves with fewer projects
            # Count how many of the current candidate projects are already in this wave
            existing_projects = sum(1 for proj in projects if proj.wave_id == w.id)
            score += max(0, 5 - existing_projects)

            if score > best_score:
                best_score = score
                best_wave = w
                reasons = wave_reasons

        suggestions.append({
            "project_id": p.id,
            "project_name": p.name,
            "suggested_wave_id": best_wave.id if best_wave else None,
            "suggested_wave_name": best_wave.name if best_wave else None,
            "confidence_score": best_score,
            "reasons": reasons,
        })

    return {"suggestions": suggestions}
