import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wave import Wave
from app.schemas.wave import WaveCreate, WavePatch


async def get_all(session: AsyncSession) -> list[Wave]:
    result = await session.execute(select(Wave).order_by(Wave.created_at.desc()))
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, wave_id: str) -> Wave | None:
    return await session.get(Wave, wave_id)


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


async def import_from_jira(session: AsyncSession, epic_key: str) -> Wave:
    """Import a wave from Jira by epic key."""
    result = await session.execute(select(Wave).filter(Wave.jira_epic_key == epic_key))
    existing_wave = result.scalar_one_or_none()
    if existing_wave:
        raise ValueError(f"Wave with epic key {epic_key} already exists")

    from app.services import jira_client

    epic_data = await jira_client.get_epic(epic_key)
    project_key = epic_data.get("jira_project_key") or (epic_key.split("-")[0] if "-" in epic_key else "MIG")

    wave = Wave(
        id=str(uuid.uuid4()),
        name=epic_data.get("name") or f"Wave imported from {epic_key}",
        start_date=epic_data.get("start_date") or "2026-01-01",
        cutover_date=epic_data.get("cutover_date") or "2026-12-31",
        description=epic_data.get("description") or None,
        jira_project_key=project_key,
        jira_epic_key=epic_key,
        source="imported",
        status="planned",
    )
    session.add(wave)
    await session.flush()
    await session.refresh(wave)
    return wave
