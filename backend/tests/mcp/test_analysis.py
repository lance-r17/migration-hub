import pytest

from app.mcp.context import McpContext
from app.mcp.tools.analysis import (
    analyze_wave_readiness,
    check_scheduling_conflicts,
    analyze_dependency_graph,
    compute_resource_migration_progress,
    analyze_risk_exposure,
    identify_approval_bottlenecks,
    suggest_wave_assignments,
)


class TestAnalysisTools:
    @pytest.mark.asyncio
    async def test_analyze_wave_readiness(self, db_session):
        from app.mcp.tools.discovery import list_waves
        ctx = McpContext(user=None, db=db_session)
        waves = await list_waves({}, ctx)
        if not waves:
            pytest.skip("No waves in database")
        result = await analyze_wave_readiness({"wave_id": waves[0]["id"]}, ctx)
        assert "wave_id" in result
        assert "projects" in result
        assert isinstance(result["projects"], list)

    @pytest.mark.asyncio
    async def test_analyze_wave_readiness_not_found(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await analyze_wave_readiness({"wave_id": "nonexistent"}, ctx)
        assert "error" in result

    @pytest.mark.asyncio
    async def test_check_scheduling_conflicts(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await check_scheduling_conflicts({}, ctx)
        assert "embargo_overlaps" in result
        assert "date_constraint_violations" in result
        assert "dependency_date_gaps" in result

    @pytest.mark.asyncio
    async def test_analyze_dependency_graph(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await analyze_dependency_graph({}, ctx)
        assert "nodes" in result
        assert "edges" in result
        assert "cycles" in result
        assert "orphan_nodes" in result

    @pytest.mark.asyncio
    async def test_compute_resource_migration_progress(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await compute_resource_migration_progress({}, ctx)
        assert "total_resources" in result
        assert "by_category" in result

    @pytest.mark.asyncio
    async def test_analyze_risk_exposure(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await analyze_risk_exposure({}, ctx)
        assert "total_open_risks" in result
        assert "risks_by_severity" in result

    @pytest.mark.asyncio
    async def test_identify_approval_bottlenecks(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await identify_approval_bottlenecks({}, ctx)
        assert "total_projects_checked" in result
        assert "bottlenecks" in result

    @pytest.mark.asyncio
    async def test_suggest_wave_assignments(self, db_session):
        ctx = McpContext(user=None, db=db_session)
        result = await suggest_wave_assignments({"unassigned_only": True}, ctx)
        assert "suggestions" in result
