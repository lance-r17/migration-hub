import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.embargo import EmbargoRecord
from app.schemas.embargo import EmbargoCreate, EmbargoUpdate


async def get_all(session: AsyncSession) -> list[EmbargoRecord]:
    result = await session.execute(select(EmbargoRecord).order_by(EmbargoRecord.start_date))
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, embargo_id: str) -> EmbargoRecord | None:
    return await session.get(EmbargoRecord, embargo_id)


async def create(session: AsyncSession, data: EmbargoCreate) -> EmbargoRecord:
    embargo = EmbargoRecord(
        id=data.id or str(uuid.uuid4()),
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        affected_service_lines=data.affected_service_lines,
    )
    session.add(embargo)
    await session.flush()
    await session.refresh(embargo)
    return embargo


async def update(
    session: AsyncSession, embargo: EmbargoRecord, patch: EmbargoUpdate
) -> EmbargoRecord:
    for field, value in patch.model_dump(exclude_none=True).items():
        setattr(embargo, field, value)
    await session.flush()
    await session.refresh(embargo)
    return embargo


async def delete(session: AsyncSession, embargo: EmbargoRecord) -> None:
    await session.delete(embargo)
    await session.flush()
