"""Tests for GET /api/v1/projects/home-summary — platform-lead landing payload."""

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


def _fresh_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def lead_client(db_session: AsyncSession):
    app = create_app()

    async def override_get_db():
        yield db_session

    lead = User(
        id=_fresh_id("usr"),
        name="Lead",
        email=f"lead-{uuid.uuid4().hex[:6]}@example.com",
        department="IT",
        initials="LD",
        role="platform_migration_lead",
    )

    async def override_get_current_user():
        return lead

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


class TestHomeSummary:
    @pytest.mark.asyncio
    async def test_returns_latest_active_and_total(self, lead_client: AsyncClient, db_session: AsyncSession):
        before = (await lead_client.get("/api/v1/projects/home-summary")).json()
        before_total = before["total"]

        active_ids = []
        for i in range(7):
            status = "completed" if i < 2 else "planning"
            p = Project(id=_fresh_id("proj"), name=f"SummaryProj{i}", status=status)
            db_session.add(p)
            if status != "completed":
                active_ids.append(p.id)
        await db_session.commit()

        r = await lead_client.get("/api/v1/projects/home-summary")
        assert r.status_code == 200
        data = r.json()

        # total counts every project, including completed
        assert data["total"] == before_total + 7
        # at most 5 latest active projects, completed excluded
        items = data["projects"]
        assert len(items) <= 5
        assert all(i["status"] != "completed" for i in items)
        # our freshly created active projects are the newest → all present
        returned_ids = {i["id"] for i in items}
        assert set(active_ids) <= returned_ids
        # card fields present
        first = items[0]
        for key in ("id", "name", "status", "progress", "stage_progress", "team", "resource_count"):
            assert key in first
