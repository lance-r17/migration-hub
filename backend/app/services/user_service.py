import logging

from sqlalchemy import delete, select
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


async def get_by_api_key_hash(session: AsyncSession, key_hash: str) -> User | None:
    result = await session.execute(
        select(User).where(User.api_key_hash == key_hash, User.is_service_account == True)
    )
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


async def create_user(session: AsyncSession, user: User) -> User:
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def sync_user_projects(
    session: AsyncSession, user_id: str, project_ids: list[str]
) -> None:
    """Sync a user's AD-group-based project memberships (role='member').
    Governance roles (business_owner, technical_lead, etc.) are left untouched."""
    # Remove stale 'member' rows for projects no longer in AD groups
    if project_ids:
        await session.execute(
            delete(ProjectUser).where(
                (ProjectUser.user_id == user_id)
                & (ProjectUser.role == "member")
                & (ProjectUser.project_id.not_in(project_ids))
            )
        )
    else:
        await session.execute(
            delete(ProjectUser).where(
                (ProjectUser.user_id == user_id) & (ProjectUser.role == "member")
            )
        )

    # Add 'member' rows for new projects; skip if user already has a role there
    for project_id in project_ids:
        project = await session.get(Project, project_id)
        if project is None:
            logging.getLogger(__name__).warning(
                "Project %s not found, skipping AD group assignment for user %s",
                project_id,
                user_id,
            )
            continue
        existing = await session.get(ProjectUser, (project_id, user_id))
        if existing is None:
            session.add(ProjectUser(project_id=project_id, user_id=user_id, role="member"))

    await session.commit()
