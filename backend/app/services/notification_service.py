import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.config_store import ConfigStore
from app.models.notification import Notification

_CONFIG_KEY = "notification_config"
_DEFAULT: dict[str, Any] = {"retention_limit": 50}


async def get_notification_config(session: AsyncSession) -> dict[str, Any]:
    row = await session.get(ConfigStore, _CONFIG_KEY)
    if row and isinstance(row.value, dict):
        merged = dict(_DEFAULT)
        merged.update(row.value)
        return merged
    return dict(_DEFAULT)


async def set_notification_config(
    session: AsyncSession, patch: dict[str, Any]
) -> dict[str, Any]:
    row = await session.get(ConfigStore, _CONFIG_KEY)
    current = dict(_DEFAULT)
    if row and isinstance(row.value, dict):
        current.update(row.value)
    current.update(patch)
    if row:
        row.value = current
        flag_modified(row, "value")
    else:
        session.add(ConfigStore(key=_CONFIG_KEY, value=current))
    await session.flush()
    return current


async def create_notification(
    session: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
) -> Notification:
    """Create a notification for a user, then prune the user's oldest
    notifications beyond the configured retention limit."""
    notification = Notification(
        id=f"ntf-{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    session.add(notification)
    await session.flush()

    config = await get_notification_config(session)
    limit = int(config["retention_limit"])
    excess_ids = (
        select(Notification.id)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset(limit)
    )
    await session.execute(
        delete(Notification).where(Notification.id.in_(excess_ids))
    )
    await session.flush()
    return notification
