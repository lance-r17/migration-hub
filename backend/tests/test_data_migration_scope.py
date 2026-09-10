"""Tests for POST /api/v1/projects/{id}/data-migration-remove-from-scope."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.main import create_app
from app.models.project import Project
from app.models.user import User


def _client(db_session: AsyncSession, role: str) -> AsyncClient:
    app = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        suffix = id(role)
        return User(
            id=f"usr-{suffix}",
            name="Test User",
            email=f"test-{suffix}@example.com",
            department="IT",
            initials="TU",
            role=role,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _project_with_plan(db_session: AsyncSession) -> Project:
    p = Project(
        id=f"proj-dm-scope-{uuid.uuid4().hex[:8]}",
        name="DM Scope Project",
        status="migrating",
        data_migration_schedule={"startDate": "2026-05-01", "endDate": "2026-05-07"},
        data_migration_plan={
            "startDate": "2026-05-01",
            "endDate": "2026-05-07",
            "completedAt": "2026-05-08T10:00:00+00:00",
        },
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


class TestRemoveFromDataMigrationScope:
    @pytest.mark.asyncio
    async def test_platform_lead_can_remove(self, db_session: AsyncSession):
        p = await _project_with_plan(db_session)
        async with _client(db_session, "platform_migration_lead") as client:
            r = await client.post(f"/api/v1/projects/{p.id}/data-migration-remove-from-scope")
        assert r.status_code == 200
        body = r.json()
        assert body["data_migration_plan"] is None
        assert body["data_migration_schedule"] is None

        await db_session.refresh(p)
        assert p.data_migration_plan is None
        assert p.data_migration_schedule is None

    @pytest.mark.asyncio
    async def test_non_lead_forbidden(self, db_session: AsyncSession):
        p = await _project_with_plan(db_session)
        async with _client(db_session, "member") as client:
            r = await client.post(f"/api/v1/projects/{p.id}/data-migration-remove-from-scope")
        assert r.status_code == 403

        await db_session.refresh(p)
        assert p.data_migration_plan is not None

    @pytest.mark.asyncio
    async def test_unknown_project_404(self, db_session: AsyncSession):
        async with _client(db_session, "platform_migration_lead") as client:
            r = await client.post("/api/v1/projects/no-such-project/data-migration-remove-from-scope")
        assert r.status_code == 404
