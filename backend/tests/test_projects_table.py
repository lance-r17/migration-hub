"""Tests for GET /api/v1/projects/table — backend pagination + filtering."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.main import create_app
from app.models.approval import Approval
from app.models.cloud_resource import CloudResource
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.survey_draft import SurveyDraft
from app.models.user import User


def _fresh_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _make_user(role: str, bgi_ids: list[str] | None = None) -> User:
    suffix = uuid.uuid4().hex[:8]
    return User(
        id=f"usr-{suffix}",
        name="Test User",
        email=f"test-user-{suffix}@example.com",
        department="Platform",
        initials="TU",
        role=role,
        bgi_ids=bgi_ids or [],
    )


async def _create_project(
    session: AsyncSession,
    *,
    name: str = "Test Project",
    status: str = "planning",
    bgi_id: str | None = None,
    planning: dict | None = None,
    application_overview: dict | None = None,
    survey_submitted: bool = False,
) -> Project:
    project = Project(
        id=_fresh_id("proj"),
        name=name,
        status=status,
        bgi_id=bgi_id,
        planning=planning,
        application_overview=application_overview,
        survey_submitted_at=datetime.now(timezone.utc) if survey_submitted else None,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def _make_in_progress(session: AsyncSession, project: Project) -> None:
    """Give a project setup=100 (resource in scope + governance role)."""
    user = User(
        id=f"usr-{uuid.uuid4().hex[:8]}",
        name="Member",
        email=f"m-{uuid.uuid4().hex[:6]}@example.com",
        department="IT",
        initials="MB",
        role="member",
    )
    session.add(user)
    session.add(
        CloudResource(
            resource_id=_fresh_id("res"),
            project_id=project.id,
            name="vm",
            product="ecs",
            resource_set="rs-prod",
            need_migration=True,
        )
    )
    session.add(
        ProjectUser(project_id=project.id, user_id=user.id, role="technical_lead")
    )
    await session.commit()


@pytest_asyncio.fixture
async def lead_client(db_session: AsyncSession):
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


def _member_client_fixture(db_session: AsyncSession, member: User):
    app = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return member

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestProjectsTablePagination:
    @pytest.mark.asyncio
    async def test_pagination_totals(self, lead_client: AsyncClient, db_session: AsyncSession):
        prefix = f"PageProj-{uuid.uuid4().hex[:6]}"
        for i in range(25):
            await _create_project(db_session, name=f"{prefix} {i:02d}")

        r1 = await lead_client.get(
            "/api/v1/projects/table", params={"page": 1, "page_size": 20, "search": prefix}
        )
        assert r1.status_code == 200
        body = r1.json()
        assert len(body["items"]) == 20
        assert body["total"] == 25
        assert body["page"] == 1
        assert body["page_size"] == 20

        r2 = await lead_client.get(
            "/api/v1/projects/table", params={"page": 2, "page_size": 20, "search": prefix}
        )
        assert len(r2.json()["items"]) == 5

    @pytest.mark.asyncio
    async def test_page_size_zero_returns_all(self, lead_client: AsyncClient, db_session: AsyncSession):
        await _create_project(db_session, name="AllProj A")
        await _create_project(db_session, name="AllProj B")
        r = await lead_client.get("/api/v1/projects/table", params={"page_size": 0})
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == len(body["items"])

    @pytest.mark.asyncio
    async def test_lean_payload_shape(self, lead_client: AsyncClient, db_session: AsyncSession):
        await _create_project(db_session, name="LeanProj")
        r = await lead_client.get("/api/v1/projects/table", params={"search": "LeanProj"})
        item = r.json()["items"][0]
        assert "cloud_resources" not in item
        assert "dependencies" not in item
        assert "approvals" not in item
        assert item["has_survey_draft"] is False
        assert item["infra_footprint"]["score"] == "Lightweight"
        assert item["migration_driver"]["score"] == "Low"


class TestProjectsTableFilters:
    @pytest.mark.asyncio
    async def test_search_matches_name_id_app_ba(self, lead_client: AsyncClient, db_session: AsyncSession):
        p = await _create_project(
            db_session,
            name="Searchable Alpha",
            application_overview={"applicationName": "Core Banking", "baId": "BA-999"},
        )
        for term in ("Searchable", p.id, "core banking", "ba-999"):
            r = await lead_client.get("/api/v1/projects/table", params={"search": term, "page_size": 0})
            ids = [i["id"] for i in r.json()["items"]]
            assert p.id in ids, f"search {term!r} should match {p.id}"

        r = await lead_client.get("/api/v1/projects/table", params={"search": "no-such-thing-xyz"})
        assert r.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_bgi_filter(self, lead_client: AsyncClient, db_session: AsyncSession):
        p1 = await _create_project(db_session, name="BGI One", bgi_id="bgi-1")
        p2 = await _create_project(db_session, name="BGI Two", bgi_id="bgi-2")
        r = await lead_client.get(
            "/api/v1/projects/table",
            params={"page_size": 0, "bgi_ids": ["bgi-1"]},
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert p1.id in ids
        assert p2.id not in ids

    @pytest.mark.asyncio
    async def test_migration_range_filter(self, lead_client: AsyncClient, db_session: AsyncSession):
        short = await _create_project(
            db_session, name="ShortRange", planning={"startDate": "2026-01-01", "endDate": "2026-01-15"}
        )
        long = await _create_project(
            db_session, name="LongRange", planning={"startDate": "2026-01-01", "endDate": "2026-12-31"}
        )
        no_dates = await _create_project(db_session, name="NoDates")

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "migration_range": "lt30"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert short.id in ids
        assert long.id not in ids
        assert no_dates.id not in ids

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "migration_range": "gte180"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert long.id in ids
        assert short.id not in ids

    @pytest.mark.asyncio
    async def test_migration_range_uses_derived_milestone_union(self, lead_client: AsyncClient, db_session: AsyncSession):
        """Stored planning dates are short, but milestone union makes the period long."""
        unioned = await _create_project(
            db_session,
            name="Unioned",
            planning={
                "startDate": "2026-01-10",
                "endDate": "2026-01-20",
                "milestones": [
                    {"id": "m1", "name": "Dev", "type": "custom", "start": "2026-01-10", "end": "2026-01-20", "status": "todo", "deps": []},
                    {"id": "m2", "name": "Cutover", "type": "custom", "start": "2026-06-01", "end": "2026-08-31", "status": "todo", "deps": []},
                ],
            },
        )
        env_extends = await _create_project(
            db_session,
            name="EnvExtends",
            planning={
                "startDate": "2026-01-10",
                "endDate": "2026-01-20",
                "milestones": [
                    {"id": "m1", "name": "Dev", "type": "custom", "start": "2026-01-10", "end": "2026-01-20", "status": "todo", "deps": []},
                ],
            },
        )
        env_extends.environment_provision = {"prod": {"date": "2026-09-30"}}
        db_session.add(env_extends)
        await db_session.commit()

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "migration_range": "gte180"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert unioned.id in ids
        assert env_extends.id in ids

        items = {i["id"]: i for i in r.json()["items"]}
        assert items[unioned.id]["planning"] == {"startDate": "2026-01-10", "endDate": "2026-08-31"}
        assert items[env_extends.id]["planning"] == {"startDate": "2026-01-10", "endDate": "2026-09-30"}

    @pytest.mark.asyncio
    async def test_role_filter(self, lead_client: AsyncClient, db_session: AsyncSession):
        user = _make_user("member")
        user.name = "Role Person"
        db_session.add(user)
        champion_proj = await _create_project(db_session, name="ChampionProj")
        itso_proj = await _create_project(db_session, name="ItsoProj")
        plain_proj = await _create_project(db_session, name="PlainProj")
        db_session.add(ProjectUser(project_id=champion_proj.id, user_id=user.id, role="gbi_champion"))
        db_session.add(ProjectUser(project_id=itso_proj.id, user_id=user.id, role="itso"))
        await db_session.commit()

        r = await lead_client.get(
            "/api/v1/projects/table",
            params={"page_size": 0, "role": "gbi_champion", "role_user_id": user.id},
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert champion_proj.id in ids
        assert itso_proj.id not in ids
        assert plain_proj.id not in ids

        items = {i["id"]: i for i in r.json()["items"]}
        assert items[champion_proj.id]["gbi_champion"] == "Role Person"

        r = await lead_client.get(
            "/api/v1/projects/table",
            params={"page_size": 0, "role": "itso", "role_user_id": user.id},
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert itso_proj.id in ids
        assert champion_proj.id not in ids

    @pytest.mark.asyncio
    async def test_plain_status_filter(self, lead_client: AsyncClient, db_session: AsyncSession):
        planning = await _create_project(db_session, name="PlanningProj", status="planning")
        blocked = await _create_project(db_session, name="BlockedProj", status="blocked")

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "status": "planning"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert planning.id in ids
        assert blocked.id not in ids

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "status": "blocked"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert blocked.id in ids
        assert planning.id not in ids

    @pytest.mark.asyncio
    async def test_derived_status_filters(self, lead_client: AsyncClient, db_session: AsyncSession):
        # setup=100, survey<100 → in-progress; draft decides awaiting vs drafting
        drafting = await _create_project(db_session, name="DraftingProj")
        awaiting = await _create_project(db_session, name="AwaitingProj")
        await _make_in_progress(db_session, drafting)
        await _make_in_progress(db_session, awaiting)
        db_session.add(
            SurveyDraft(
                id=_fresh_id("sd"),
                user_id="usr-x",
                project_id=drafting.id,
                payload={"current_index": 0, "answers": {}},
            )
        )
        await db_session.commit()

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "status": "drafting-survey"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert drafting.id in ids
        assert awaiting.id not in ids

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "status": "awaiting-survey"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert awaiting.id in ids
        assert drafting.id not in ids

        # has_survey_draft flag on the unfiltered list
        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "search": "DraftingProj"}
        )
        item = r.json()["items"][0]
        assert item["has_survey_draft"] is True
        assert item["status"] == "in-progress"

    @pytest.mark.asyncio
    async def test_survey_submitted_and_awaiting_signoff(
        self, lead_client: AsyncClient, db_session: AsyncSession
    ):
        submitted = await _create_project(db_session, name="SubmittedProj", survey_submitted=True)
        await _make_in_progress(db_session, submitted)

        signoff = await _create_project(db_session, name="SignoffProj", survey_submitted=True)
        await _make_in_progress(db_session, signoff)
        db_session.add(
            Approval(
                id=_fresh_id("appr"),
                project_id=signoff.id,
                role="technical_lead",
                status="approved",
                icon="check",
            )
        )
        db_session.add(
            Approval(
                id=_fresh_id("appr"),
                project_id=signoff.id,
                role="gbi_champion",
                status="pending",
                icon="check",
            )
        )
        db_session.add(
            Approval(
                id=_fresh_id("appr"),
                project_id=signoff.id,
                role="platform_migration_lead",
                status="pending",
                icon="check",
            )
        )
        await db_session.commit()

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "status": "survey-submitted"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert submitted.id in ids
        assert signoff.id not in ids

        r = await lead_client.get(
            "/api/v1/projects/table", params={"page_size": 0, "status": "awaiting-signoff"}
        )
        ids = [i["id"] for i in r.json()["items"]]
        assert signoff.id in ids
        assert submitted.id not in ids


class TestProjectsTableRoleScoping:
    @pytest.mark.asyncio
    async def test_member_sees_only_own_projects(self, db_session: AsyncSession):
        member = _make_user("member")
        db_session.add(member)
        own = await _create_project(db_session, name="OwnProj")
        other = await _create_project(db_session, name="OtherProj")
        db_session.add(ProjectUser(project_id=own.id, user_id=member.id, role="gbi_champion"))
        await db_session.commit()

        async with _member_client_fixture(db_session, member) as client:
            r = await client.get("/api/v1/projects/table", params={"page_size": 0})
        ids = [i["id"] for i in r.json()["items"]]
        assert own.id in ids
        assert other.id not in ids

    @pytest.mark.asyncio
    async def test_bgi_cloud_lead_restricted_to_descendants(self, db_session: AsyncSession):
        lead = _make_user("bgi_cloud_lead", bgi_ids=["bgi-root"])
        db_session.add(lead)
        inside = await _create_project(db_session, name="InsideBGI", bgi_id="bgi-root")
        outside = await _create_project(db_session, name="OutsideBGI", bgi_id="bgi-other")
        await db_session.commit()

        async with _member_client_fixture(db_session, lead) as client:
            r = await client.get("/api/v1/projects/table", params={"page_size": 0})
        ids = [i["id"] for i in r.json()["items"]]
        assert inside.id in ids
        assert outside.id not in ids
