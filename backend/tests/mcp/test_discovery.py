import pytest

from app.mcp.context import McpContext
from app.mcp.tools.discovery import (
    list_waves,
    get_wave_detail,
    list_embargos,
    list_users,
    search_projects,
    get_project_detail,
)


class TestDiscoveryTools:
    @pytest.mark.asyncio
    async def test_list_waves(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await list_waves({}, ctx)
        assert isinstance(result, list)
        if result:
            assert "id" in result[0]
            assert "project_count" in result[0]

    @pytest.mark.asyncio
    async def test_get_wave_detail(self, db_session):
        # First list waves to get a valid ID
        ctx = McpContext(user=None, db=db_session)
        waves = await list_waves({}, ctx)
        if not waves:
            pytest.skip("No waves in database")
        wave_id = waves[0]["id"]
        detail = await get_wave_detail({"wave_id": wave_id}, ctx)
        assert "id" in detail
        assert "projects" in detail

    @pytest.mark.asyncio
    async def test_get_wave_detail_not_found(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        detail = await get_wave_detail({"wave_id": "nonexistent"}, ctx)
        assert "error" in detail

    @pytest.mark.asyncio
    async def test_list_embargos(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await list_embargos({}, ctx)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_list_users(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await list_users({}, ctx)
        assert isinstance(result, list)
        if result:
            assert "id" in result[0]
            assert "name" in result[0]

    @pytest.mark.asyncio
    async def test_search_projects_no_filter(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await search_projects({}, ctx)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_search_projects_by_status(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await search_projects({"status": "planning", "limit": 5}, ctx)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_project_detail_not_found(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await get_project_detail({"project_id": "nonexistent"}, ctx)
        assert "error" in result
