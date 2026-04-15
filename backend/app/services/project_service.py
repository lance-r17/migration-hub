import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.approval import Approval
from app.models.cloud_resource import CloudResource
from app.models.project import Project
from app.models.risk import Risk
from app.schemas.project import ProjectCreate, ProjectPatch
from app.services import audit_service

# Maps camelCase frontend section keys → ORM column names
SECTION_COLUMN_MAP: dict[str, str | None] = {
    "applicationOverview": "application_overview",
    "availability": "availability",
    "dataPersistence": "data_persistence",
    "dependencies": "dependencies",
    "nfrs": "nfrs",
    "migrationConstraints": "migration_constraints",
    "targetArchitecture": "target_architecture",
    "team": "team",
    "jiraSubtaskConfig": "jira_subtask_config",
    "status": "status",
    # Special: delegate to relational tables
    "currentInfrastructure": None,
    "risks": None,
    "approvals": None,
}

SECTION_LABELS: dict[str, str] = {
    "applicationOverview": "Application Overview",
    "availability": "Availability & Resilience",
    "dataPersistence": "Data & Persistence",
    "dependencies": "Dependencies",
    "nfrs": "Non-Functional Requirements",
    "migrationConstraints": "Migration Constraints",
    "targetArchitecture": "Target Architecture",
    "team": "Team",
    "status": "Project Status",
}


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


def _classify_resource_changes(
    old_list: list, new_list: list[dict]
) -> list[tuple[str, str, list[dict]]]:
    """Returns (resource_id, entity_label, changes) per changed resource.

    - Removed: empty changes list (entityLabel carries the resource name)
    - Added: empty changes list
    - Specs modified: field-level diff via _diff_section
    """
    result = []
    old_map = {r.id: r for r in old_list}
    new_map = {r_data["id"]: r_data for r_data in new_list if r_data.get("id")}

    for rid, r in old_map.items():
        if rid not in new_map:
            result.append((rid, r.name, []))

    for rid, r_data in new_map.items():
        name = r_data.get("name", rid)
        old_r = old_map.get(rid)
        if old_r is None:
            result.append((rid, name, []))
        else:
            spec_changes = _diff_section(old_r.specs or {}, r_data.get("specs") or {})
            if spec_changes:
                result.append((rid, name, spec_changes))

    return result


def _project_options():
    return [
        selectinload(Project.cloud_resources),
        selectinload(Project.risks),
        selectinload(Project.approvals),
        selectinload(Project.wave),
    ]


async def get_all(
    session: AsyncSession, user_id: str | None = None
) -> list[Project]:
    from app.models.project_user import ProjectUser

    q = select(Project).options(
        selectinload(Project.approvals),
        selectinload(Project.cloud_resources),
        selectinload(Project.wave),
    )
    if user_id:
        q = q.join(ProjectUser, ProjectUser.project_id == Project.id).where(
            ProjectUser.user_id == user_id
        )
    result = await session.execute(q.order_by(Project.name))
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, project_id: str) -> Project | None:
    result = await session.execute(
        select(Project).where(Project.id == project_id).options(*_project_options())
    )
    return result.scalar_one_or_none()


async def create(session: AsyncSession, data: ProjectCreate) -> Project:
    project = Project(
        id=data.id or f"PRJ-{uuid.uuid4().hex[:8].upper()}",
        name=data.name,
        status=data.status,
        progress=data.progress,
        description=data.description,
        wave_id=data.wave_id,
    )
    session.add(project)
    await session.flush()
    await session.refresh(project)
    return project


async def update(
    session: AsyncSession,
    project: Project,
    patch: ProjectPatch,
    actor: dict[str, Any],
) -> Project:
    changes = []
    for field, value in patch.model_dump(exclude_none=True).items():
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


async def update_section(
    session: AsyncSession,
    project: Project,
    section_key: str,
    value: Any,
    actor: dict[str, Any],
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
    else:
        old = getattr(project, column, None)
        setattr(project, column, value)
        changes = _diff_section(old, value)
        if changes:
            await audit_service.append_entry(
                session,
                project_id=project.id,
                event_type="section_updated",
                entity_type="section",
                actor=actor,
                section_key=section_key,
                section_label=SECTION_LABELS.get(section_key, section_key),
                changes=changes,
            )

    await session.flush()
    await session.refresh(project)
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
            id=r_data.get("id") or str(uuid.uuid4()),
            project_id=project.id,
            resource_id=r_data.get("resourceId"),
            name=r_data.get("name", ""),
            product=r_data.get("product"),
            resource_set=r_data.get("resourceSet"),
            specs=r_data.get("specs"),
            sub_application=r_data.get("subApplication"),
            target_resource_id=r_data.get("targetResourceId"),
            sync_status=r_data.get("syncStatus", "out-of-sync"),
            need_migration=r_data.get("needMigration", True),
            jira_subtask_key=r_data.get("jiraSubtaskKey"),
        )
        session.add(resource)
    for rid, entity_label, resource_changes in resource_events:
        await audit_service.append_entry(
            session, project_id=project.id,
            event_type="resource_updated",
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


async def _replace_approvals(
    session: AsyncSession, project: Project, value: Any, actor: dict[str, Any]
) -> None:
    approvals_data = value if isinstance(value, list) else []
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
    await audit_service.append_entry(
        session, project_id=project.id, event_type="approval_submitted",
        entity_type="approval", actor=actor, changes=[],
    )


async def batch_update_resource_specs(
    session: AsyncSession, project_id: str, updates: list[dict[str, Any]],
    actor: dict[str, Any] | None = None,
) -> None:
    for upd in updates:
        resource_id = upd.get("id")
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
                    entity_id=resource.id,
                    entity_label=resource.name,
                    changes=resource_changes,
                )
    await session.flush()
