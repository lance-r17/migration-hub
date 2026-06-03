import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category_milestone import CategoryMilestone
from app.models.project import Project
from app.schemas.category_milestone import CategoryMilestoneCreate, CategoryMilestoneUpdate


async def get_all(session: AsyncSession) -> list[CategoryMilestone]:
    result = await session.execute(
        select(CategoryMilestone).order_by(CategoryMilestone.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, cm_id: str) -> CategoryMilestone | None:
    return await session.get(CategoryMilestone, cm_id)


async def create(session: AsyncSession, data: CategoryMilestoneCreate) -> CategoryMilestone:
    cm = CategoryMilestone(
        id=data.id or str(uuid.uuid4()),
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        color=data.color,
        icon=data.icon,
    )
    session.add(cm)
    await session.flush()
    await session.refresh(cm)
    return cm


async def update(
    session: AsyncSession, cm: CategoryMilestone, patch: CategoryMilestoneUpdate
) -> CategoryMilestone:
    for field, value in patch.model_dump(exclude_none=True).items():
        setattr(cm, field, value)
    await session.flush()
    await session.refresh(cm)
    return cm


async def delete(session: AsyncSession, cm: CategoryMilestone) -> None:
    await session.delete(cm)
    await session.flush()


async def batch_assign(
    session: AsyncSession, cm_id: str, project_ids: list[str], unassign: bool = False
) -> None:
    cm = await get_by_id(session, cm_id)
    if not cm:
        raise ValueError(f"Category milestone {cm_id} not found")

    if unassign:
        for pid in project_ids:
            result = await session.execute(
                select(Project).where(Project.id == pid).options(selectinload(Project.category_milestones))
            )
            project = result.scalar_one_or_none()
            if project and cm in project.category_milestones:
                project.category_milestones.remove(cm)
    else:
        for pid in project_ids:
            result = await session.execute(
                select(Project).where(Project.id == pid).options(selectinload(Project.category_milestones))
            )
            project = result.scalar_one_or_none()
            if project and cm not in project.category_milestones:
                project.category_milestones.append(cm)

    await session.flush()
