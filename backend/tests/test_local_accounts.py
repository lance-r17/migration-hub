"""Tests for the Early Access Experience local account endpoints."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.main import create_app
from app.models.user import User


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
        id=f"usr-la-{uuid.uuid4().hex[:8]}",
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


class TestLocalAccounts:
    @pytest.mark.asyncio
    async def test_admin_crud_flow(self, admin_client: AsyncClient, target_user: User):
        base = f"/api/v1/admin/users/{target_user.id}/local-account"

        # Create
        res = await admin_client.post(
            base, json={"account_name": f"{target_user.id}-poc", "password": "s3cret"}
        )
        assert res.status_code == 201
        body = res.json()
        assert body["account_name"] == f"{target_user.id}-poc"
        assert "password" not in body

        # Admin GET never exposes the password
        res = await admin_client.get(base)
        assert res.status_code == 200
        assert "password" not in res.json()

        # Duplicate create for the same user -> 409
        res = await admin_client.post(
            base, json={"account_name": "other-name", "password": "x"}
        )
        assert res.status_code == 409

        # Update password
        res = await admin_client.put(base, json={"password": "new-p4ss"})
        assert res.status_code == 200
        assert "password" not in res.json()

        # Delete
        res = await admin_client.delete(base)
        assert res.status_code == 204
        res = await admin_client.get(base)
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_account_name_globally_unique(
        self, admin_client: AsyncClient, db_session: AsyncSession, target_user: User
    ):
        other = User(
            id=f"usr-la-{uuid.uuid4().hex[:8]}",
            name="Other User",
            email=f"other-{uuid.uuid4().hex[:8]}@example.com",
            department="IT",
            initials="OU",
        )
        db_session.add(other)
        await db_session.commit()

        res = await admin_client.post(
            f"/api/v1/admin/users/{target_user.id}/local-account",
            json={"account_name": "shared-poc", "password": "x"},
        )
        assert res.status_code == 201

        res = await admin_client.post(
            f"/api/v1/admin/users/{other.id}/local-account",
            json={"account_name": "shared-poc", "password": "x"},
        )
        assert res.status_code == 409

    @pytest.mark.asyncio
    async def test_owner_can_retrieve_password(
        self, admin_client: AsyncClient, db_session: AsyncSession, target_user: User
    ):
        res = await admin_client.post(
            f"/api/v1/admin/users/{target_user.id}/local-account",
            json={"account_name": f"{target_user.id}-poc", "password": "s3cret"},
        )
        assert res.status_code == 201

        owner_client = _client(db_session, target_user)
        res = await owner_client.get("/api/v1/users/me/local-account")
        assert res.status_code == 200
        assert res.json() == {
            "account_name": f"{target_user.id}-poc",
            "password": "s3cret",
        }

    @pytest.mark.asyncio
    async def test_owner_without_account_gets_404(
        self, db_session: AsyncSession, target_user: User
    ):
        owner_client = _client(db_session, target_user)
        res = await owner_client.get("/api/v1/users/me/local-account")
        assert res.status_code == 404
