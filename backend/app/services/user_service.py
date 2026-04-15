from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.user import User


async def get_all(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User).order_by(User.name))
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, user_id: str) -> User | None:
    return await session.get(User, user_id)


async def get_current(session: AsyncSession) -> User | None:
    return await get_by_id(session, settings.current_user_id)


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_projects_for_user(session: AsyncSession, user_id: str) -> list[Project]:
    result = await session.execute(
        select(Project)
        .join(ProjectUser, ProjectUser.project_id == Project.id)
        .where(ProjectUser.user_id == user_id)
        .options(selectinload(Project.approvals))
    )
    return list(result.scalars().all())


async def get_users_for_project(session: AsyncSession, project_id: str) -> list[User]:
    result = await session.execute(
        select(User)
        .join(ProjectUser, ProjectUser.user_id == User.id)
        .where(ProjectUser.project_id == project_id)
    )
    return list(result.scalars().all())
