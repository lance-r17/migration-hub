import pytest

from app.mcp.context import McpContext
from app.mcp.tools.dashboard import (
    get_overall_stats,
    get_recent_activity,
    get_risk_register,
    get_jira_execution_status,
    get_migration_settings,
)


class TestDashboardTools:
    @pytest.mark.asyncio
    async def test_get_overall_stats(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await get_overall_stats({}, ctx)
        assert "progress" in result
        assert "total_assets" in result
        assert "completed" in result
        assert "in_progress" in result

    @pytest.mark.asyncio
    async def test_get_recent_activity(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await get_recent_activity({}, ctx)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_risk_register(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await get_risk_register({}, ctx)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_jira_execution_status(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await get_jira_execution_status({}, ctx)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_migration_settings(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await get_migration_settings({}, ctx)
        assert "duration_options" in result
