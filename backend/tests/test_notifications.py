"""Tests for the in-app notification endpoints and Early Access event hooks."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.main import create_app
from app.models.user import User
from app.services import notification_service


def _client(db_session: AsyncSession, current_user: User) -> AsyncClient:
    app = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return current_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest_asyncio.fixture
async def target_user(db_session: AsyncSession) -> User:
    user = User(
        id=f"usr-ntf-{uuid.uuid4().hex[:8]}",
        name="Target User",
        email=f"target-{uuid.uuid4().hex[:8]}@example.com",
        department="IT",
        initials="TU",
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
def admin_client(db_session: AsyncSession) -> AsyncClient:
    admin = User(
        id=f"usr-admin-{uuid.uuid4().hex[:8]}",
        name="Admin User",
        email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
        department="IT",
        initials="AU",
        role="admin",
    )
    return _client(db_session, admin)


@pytest.fixture
def owner_client(db_session: AsyncSession, target_user: User) -> AsyncClient:
    return _client(db_session, target_user)


class TestNotificationHooks:
    @pytest.mark.asyncio
    async def test_account_create_and_password_update_notify(
        self, admin_client: AsyncClient, owner_client: AsyncClient, target_user: User
    ):
        base = f"/api/v1/admin/users/{target_user.id}/local-account"

        res = await admin_client.post(
            base, json={"account_name": f"{target_user.id}-poc", "password": "s3cret"}
        )
        assert res.status_code == 201

        res = await admin_client.put(base, json={"password": "new-p4ss"})
        assert res.status_code == 200

        res = await owner_client.get("/api/v1/notifications")
        assert res.status_code == 200
        notifications = res.json()
        assert len(notifications) == 2
        assert {n["type"] for n in notifications} == {
            "early_access_account_created",
            "early_access_password_updated",
        }
        for n in notifications:
            assert n["link"] == "/account"
            assert n["read_at"] is None

        res = await owner_client.get("/api/v1/notifications/unread-count")
        assert res.json() == {"count": 2}


class TestNotificationActions:
    @pytest.mark.asyncio
    async def test_read_read_all_and_delete(
        self, db_session: AsyncSession, owner_client: AsyncClient, target_user: User
    ):
        for i in range(3):
            await notification_service.create_notification(
                db_session, target_user.id, "test", f"Title {i}", f"Message {i}"
            )

        res = await owner_client.get("/api/v1/notifications")
        notifications = res.json()
        assert len(notifications) == 3

        # Mark one read
        res = await owner_client.post(
            f"/api/v1/notifications/{notifications[0]['id']}/read"
        )
        assert res.status_code == 200
        assert res.json()["read_at"] is not None

        res = await owner_client.get("/api/v1/notifications/unread-count")
        assert res.json() == {"count": 2}

        # Mark all read
        res = await owner_client.post("/api/v1/notifications/read-all")
        assert res.status_code == 204
        res = await owner_client.get("/api/v1/notifications/unread-count")
        assert res.json() == {"count": 0}

        # Delete one
        res = await owner_client.delete(f"/api/v1/notifications/{notifications[1]['id']}")
        assert res.status_code == 204
        res = await owner_client.get("/api/v1/notifications")
        assert len(res.json()) == 2

        # Unknown id -> 404
        res = await owner_client.post("/api/v1/notifications/ntf-missing/read")
        assert res.status_code == 404
        res = await owner_client.delete("/api/v1/notifications/ntf-missing")
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_cannot_touch_other_users_notifications(
        self, db_session: AsyncSession, owner_client: AsyncClient, target_user: User
    ):
        other = User(
            id=f"usr-ntf-{uuid.uuid4().hex[:8]}",
            name="Other User",
            email=f"other-{uuid.uuid4().hex[:8]}@example.com",
            department="IT",
            initials="OU",
        )
        db_session.add(other)
        await db_session.commit()
        n = await notification_service.create_notification(
            db_session, other.id, "test", "Title", "Message"
        )
        res = await owner_client.post(f"/api/v1/notifications/{n.id}/read")
        assert res.status_code == 404
        res = await owner_client.delete(f"/api/v1/notifications/{n.id}")
        assert res.status_code == 404
        res = await owner_client.get("/api/v1/notifications")
        assert res.json() == []


class TestRetentionAndConfig:
    @pytest.mark.asyncio
    async def test_admin_config_get_and_put(self, admin_client: AsyncClient):
        res = await admin_client.get("/api/v1/admin/notification-config")
        assert res.status_code == 200
        assert res.json()["retention_limit"] == 50

        res = await admin_client.put(
            "/api/v1/admin/notification-config", json={"retention_limit": 2}
        )
        assert res.status_code == 200
        assert res.json() == {"retention_limit": 2}

        res = await admin_client.put(
            "/api/v1/admin/notification-config", json={"retention_limit": 0}
        )
        assert res.status_code == 422

    @pytest.mark.asyncio
    async def test_retention_prunes_oldest(
        self, db_session: AsyncSession, admin_client: AsyncClient, owner_client: AsyncClient, target_user: User
    ):
        res = await admin_client.put(
            "/api/v1/admin/notification-config", json={"retention_limit": 2}
        )
        assert res.status_code == 200

        for i in range(3):
            await notification_service.create_notification(
                db_session, target_user.id, "test", f"Title {i}", f"Message {i}"
            )

        res = await owner_client.get("/api/v1/notifications")
        titles = [n["title"] for n in res.json()]
        assert titles == ["Title 2", "Title 1"]
