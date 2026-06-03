import pytest
from httpx import AsyncClient


class TestCategoryMilestones:
    @pytest.mark.asyncio
    async def test_list_category_milestones(self, client: AsyncClient):
        response = await client.get("/api/v1/category-milestones")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_create_category_milestone(self, client: AsyncClient):
        payload = {
            "name": "Test CM",
            "start_date": "2026-06-01",
            "end_date": "2026-06-30",
            "color": "#FF0000",
            "icon": "cloud",
        }
        response = await client.post("/api/v1/category-milestones", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test CM"
        assert data["start_date"] == "2026-06-01"
        assert data["end_date"] == "2026-06-30"
        assert data["color"] == "#FF0000"
        assert data["icon"] == "cloud"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_category_milestone_invalid_dates(self, client: AsyncClient):
        payload = {
            "name": "Bad Dates",
            "start_date": "2026-06-30",
            "end_date": "2026-06-01",
            "color": "#FF0000",
            "icon": "cloud",
        }
        response = await client.post("/api/v1/category-milestones", json=payload)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_category_milestone(self, client: AsyncClient):
        create_resp = await client.post(
            "/api/v1/category-milestones",
            json={
                "name": "Update Me",
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "color": "#FF0000",
                "icon": "cloud",
            },
        )
        cm = create_resp.json()

        update_resp = await client.patch(
            f"/api/v1/category-milestones/{cm['id']}",
            json={"name": "Updated Name"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_delete_category_milestone(self, client: AsyncClient):
        create_resp = await client.post(
            "/api/v1/category-milestones",
            json={
                "name": "Delete Me",
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "color": "#FF0000",
                "icon": "cloud",
            },
        )
        cm = create_resp.json()

        delete_resp = await client.delete(f"/api/v1/category-milestones/{cm['id']}")
        assert delete_resp.status_code == 204

        get_resp = await client.get(f"/api/v1/category-milestones/{cm['id']}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_batch_assign_category_milestone(self, client: AsyncClient):
        # Create a category milestone
        cm_resp = await client.post(
            "/api/v1/category-milestones",
            json={
                "name": "Batch Assign",
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "color": "#FF0000",
                "icon": "cloud",
            },
        )
        cm = cm_resp.json()

        # Batch assign (project_ids may not exist in DB, but service should handle gracefully
        # or raise 404 for missing projects. We'll test the endpoint structure.)
        payload = {
            "project_ids": ["non-existent-project"],
            "unassign": False,
        }
        response = await client.post(
            f"/api/v1/category-milestones/{cm['id']}/batch-assign",
            json=payload,
        )
        # Expected behavior: 200 with count 0 or 404 if projects don't exist
        assert response.status_code in (200, 404)
