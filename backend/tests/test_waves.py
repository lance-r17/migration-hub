import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.main import create_app
from app.models.project import Project
from app.models.user import User
from app.models.wave import Wave


def _fresh_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _make_user(role: str) -> User:
    return User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        name="Test User",
        email="test-user@example.com",
        department="Platform",
        initials="TU",
        role=role,
    )


async def _create_wave(session: AsyncSession, status: str = "planned", project_order: list[str] | None = None) -> Wave:
    wave = Wave(
        id=_fresh_id("wave"),
        name="Test Wave",
        start_date="2026-01-01",
        cutover_date="2026-06-30",
        jira_project_key="MIG",
        source="created",
        status=status,
        project_order=project_order,
    )
    session.add(wave)
    await session.commit()
    await session.refresh(wave)
    return wave


async def _create_project(session: AsyncSession, wave_id: str | None = None) -> Project:
    project = Project(
        id=_fresh_id("proj"),
        name="Test Project",
        wave_id=wave_id,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


@pytest_asyncio.fixture
async def auth_client(db_session: AsyncSession):
    """HTTP client with an authenticated Platform Migration Lead user."""
    app = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return _make_user("platform_migration_lead")

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def unauth_client(db_session: AsyncSession):
    """HTTP client authenticated as a non-admin/non-lead user."""
    app = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return _make_user("member")

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestWavesBatchAssign:
    @pytest.mark.asyncio
    async def test_batch_assign_projects_to_wave(self, auth_client: AsyncClient, db_session: AsyncSession):
        source = await _create_wave(db_session, project_order=[])
        target = await _create_wave(db_session, project_order=[])
        p1 = await _create_project(db_session, wave_id=source.id)
        p2 = await _create_project(db_session, wave_id=source.id)
        # Pre-populate source project_order so we can verify cleanup.
        source.project_order = [p1.id, p2.id]
        await db_session.commit()

        # Capture IDs before any refresh/expiry.
        p1_id, p2_id = p1.id, p2.id
        source_id, target_id = source.id, target.id

        response = await auth_client.post(
            f"/api/v1/waves/{target_id}/assign-projects",
            json={"project_ids": [p1_id, p2_id]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assigned"] == [p1_id, p2_id]
        assert data["not_found"] == []
        assert data["wave"]["project_order"] == [p1_id, p2_id]

        # Verify DB state with fresh queries.
        result = await db_session.execute(select(Project).where(Project.id.in_([p1_id, p2_id])))
        projects = {p.id: p for p in result.scalars().all()}
        assert projects[p1_id].wave_id == target_id
        assert projects[p2_id].wave_id == target_id

        source_fresh = await db_session.get(Wave, source_id)
        target_fresh = await db_session.get(Wave, target_id)
        assert source_fresh.project_order == []
        assert target_fresh.project_order == [p1_id, p2_id]

    @pytest.mark.asyncio
    async def test_batch_assign_deduplicates_payload(self, auth_client: AsyncClient, db_session: AsyncSession):
        target = await _create_wave(db_session)
        p1 = await _create_project(db_session)

        response = await auth_client.post(
            f"/api/v1/waves/{target.id}/assign-projects",
            json={"project_ids": [p1.id, p1.id, p1.id]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assigned"] == [p1.id]
        assert data["wave"]["project_order"] == [p1.id]

    @pytest.mark.asyncio
    async def test_batch_assign_appends_preserves_existing_order(self, auth_client: AsyncClient, db_session: AsyncSession):
        p1 = await _create_project(db_session)
        p2 = await _create_project(db_session)
        target = await _create_wave(db_session, project_order=[p1.id])
        p1.wave_id = target.id
        await db_session.commit()

        response = await auth_client.post(
            f"/api/v1/waves/{target.id}/assign-projects",
            json={"project_ids": [p1.id, p2.id]},
        )
        assert response.status_code == 200
        data = response.json()
        # p1 was already on the target wave, so only p2 is newly assigned.
        assert data["assigned"] == [p2.id]
        # project_order should keep p1 in place and append p2.
        assert data["wave"]["project_order"] == [p1.id, p2.id]

    @pytest.mark.asyncio
    async def test_batch_assign_missing_projects(self, auth_client: AsyncClient, db_session: AsyncSession):
        target = await _create_wave(db_session)
        p1 = await _create_project(db_session)
        missing_id = _fresh_id("proj")

        response = await auth_client.post(
            f"/api/v1/waves/{target.id}/assign-projects",
            json={"project_ids": [p1.id, missing_id]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assigned"] == [p1.id]
        assert data["not_found"] == [missing_id]

    @pytest.mark.asyncio
    async def test_batch_assign_rejects_completed_wave(self, auth_client: AsyncClient, db_session: AsyncSession):
        completed = await _create_wave(db_session, status="completed")
        p1 = await _create_project(db_session)

        response = await auth_client.post(
            f"/api/v1/waves/{completed.id}/assign-projects",
            json={"project_ids": [p1.id]},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_batch_assign_denies_unauthorized_user(self, unauth_client: AsyncClient, db_session: AsyncSession):
        target = await _create_wave(db_session)
        p1 = await _create_project(db_session)

        response = await unauth_client.post(
            f"/api/v1/waves/{target.id}/assign-projects",
            json={"project_ids": [p1.id]},
        )
        assert response.status_code == 403
