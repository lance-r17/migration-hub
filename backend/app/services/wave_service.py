import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.wave import Wave
from app.schemas.wave import WaveCreate, WavePatch


async def get_all(session: AsyncSession) -> list[Wave]:
    result = await session.execute(
        select(Wave).order_by(Wave.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, wave_id: str) -> Wave | None:
    return await session.get(Wave, wave_id)


async def _validate_dates(session: AsyncSession, start_date: str, cutover_date: str) -> None:
    from app.services import migration_settings_service

    mig = await migration_settings_service.get_migration_settings(session)
    pp = mig.platform_period
    csp = mig.new_cloud_setup_period
    pp_start = pp.start_date if pp else None
    pp_end = pp.end_date if pp else None
    csp_start = csp.start_date if csp else None
    effective_start = csp_start or pp_start
    effective_end = pp_end
    if not effective_start or not effective_end:
        return
    if start_date < effective_start or cutover_date > effective_end:
        raise ValueError(
            f"Wave dates must fall within {effective_start} to {effective_end}."
        )


async def create(session: AsyncSession, data: WaveCreate) -> Wave:
    wave = Wave(
        id=str(uuid.uuid4()),
        name=data.name,
        start_date=data.start_date,
        cutover_date=data.cutover_date,
        description=data.description,
        jira_project_key=data.jira_project_key,
        jira_epic_key=data.jira_epic_key,
        source=data.source,
        status=data.status,
        color=data.color,
    )
    session.add(wave)
    await session.flush()
    await session.refresh(wave)
    return wave


async def update(session: AsyncSession, wave: Wave, patch: WavePatch) -> Wave:
    for field, value in patch.model_dump(exclude_none=True).items():
        setattr(wave, field, value)
    await session.flush()
    await session.refresh(wave)
    return wave


async def batch_assign_projects(
    session: AsyncSession,
    wave: Wave,
    project_ids: list[str],
    actor: dict[str, Any],
) -> tuple[list[str], list[str]]:
    """Assign multiple projects to a wave in one batch.

    - Deduplicates ``project_ids`` while preserving order.
    - Sets ``project.wave_id`` for each found project.
    - Appends only new IDs to ``wave.project_order``, preserving existing order.
    - Removes moved IDs from any previous wave's ``project_order``.
    - Missing projects are returned in ``not_found`` instead of raising.
    - Assigning to a completed wave is blocked.
    """
    from app.services import audit_service, project_service

    # 1. Deduplicate payload while preserving order.
    seen: set[str] = set()
    unique_ids = [pid for pid in project_ids if not (pid in seen or seen.add(pid))]

    # 2. Load all referenced projects in one query.
    result = await session.execute(select(Project).where(Project.id.in_(unique_ids)))
    project_map = {p.id: p for p in result.scalars().all()}

    assigned: list[str] = []
    not_found: list[str] = []
    source_wave_ids: set[str] = set()

    for pid in unique_ids:
        project = project_map.get(pid)
        if not project:
            not_found.append(pid)
            continue

        old_wave_id = project.wave_id
        if old_wave_id and old_wave_id != wave.id:
            source_wave_ids.add(old_wave_id)

        # Only act if the project is actually changing waves.
        if project.wave_id == wave.id:
            continue

        await project_service._check_wave_completed(session, wave.id)
        project.wave_id = wave.id
        await audit_service.append_entry(
            session,
            project_id=project.id,
            event_type="wave_assigned",
            entity_type="wave",
            actor=actor,
            entity_id=wave.id,
            entity_label=wave.name,
            changes=[{
                "field": "wave_id",
                "label": "Wave",
                "old_value": old_wave_id,
                "new_value": wave.id,
            }],
        )
        assigned.append(pid)

    # 3. Update target wave project_order: append only new IDs.
    current_order = wave.project_order or []
    current_set = set(current_order)
    wave.project_order = current_order + [pid for pid in unique_ids if pid not in current_set]

    # 4. Clean up source waves' project_order arrays.
    if source_wave_ids:
        result = await session.execute(select(Wave).where(Wave.id.in_(list(source_wave_ids))))
        for src in result.scalars().all():
            if src.project_order:
                src.project_order = [pid for pid in src.project_order if pid not in assigned]

    await session.flush()
    await session.refresh(wave)
    return assigned, not_found


async def sync_from_jira(session: AsyncSession, wave_id: str) -> Wave:
    """Sync a wave's dates and status from its linked Jira epic."""
    wave = await get_by_id(session, wave_id)
    if not wave:
        raise LookupError(f"Wave {wave_id} not found")
    if not wave.jira_epic_key:
        raise ValueError("Wave has no linked Jira epic")

    from app.services import jira_client

    epic_data = await jira_client.get_epic(wave.jira_epic_key)

    if epic_data.get("start_date"):
        wave.start_date = epic_data["start_date"]
    if epic_data.get("cutover_date"):
        wave.cutover_date = epic_data["cutover_date"]
    if epic_data.get("name"):
        wave.name = epic_data["name"]
    if epic_data.get("description") is not None:
        wave.description = epic_data["description"] or None

    status_category = (epic_data.get("jira_status_category") or "").lower()
    if "done" in status_category or "complete" in status_category:
        wave.status = "completed"
    elif "progress" in status_category or "active" in status_category:
        wave.status = "active"
    else:
        wave.status = "planned"

    await _validate_dates(session, wave.start_date, wave.cutover_date)

    await session.flush()
    await session.refresh(wave)
    return wave


async def soft_delete(session: AsyncSession, wave: Wave) -> None:
    wave.deleted = True
    result = await session.execute(select(Project).where(Project.wave_id == wave.id))
    for project in result.scalars().all():
        project.wave_id = None
    await session.flush()
    await session.refresh(wave)


async def import_from_jira(session: AsyncSession, epic_key: str, color: str | None = None) -> Wave:
    """Import a wave from Jira by epic key."""
    result = await session.execute(
        select(Wave).filter(Wave.jira_epic_key == epic_key, Wave.deleted == False)  # noqa: E712
    )
    existing_wave = result.scalar_one_or_none()
    if existing_wave:
        raise ValueError(f"Wave with epic key {epic_key} already exists")

    from app.services import jira_client

    epic_data = await jira_client.get_epic(epic_key)
    project_key = epic_data.get("jira_project_key") or (epic_key.split("-")[0] if "-" in epic_key else "MIG")

    start_date = epic_data.get("start_date") or "2026-01-01"
    cutover_date = epic_data.get("cutover_date") or "2026-12-31"
    await _validate_dates(session, start_date, cutover_date)

    wave = Wave(
        id=str(uuid.uuid4()),
        name=epic_data.get("name") or f"Wave imported from {epic_key}",
        start_date=start_date,
        cutover_date=cutover_date,
        description=epic_data.get("description") or None,
        jira_project_key=project_key,
        jira_epic_key=epic_key,
        source="imported",
        status="planned",
        color=color,
    )
    session.add(wave)
    await session.flush()
    await session.refresh(wave)
    return wave
