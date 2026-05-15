from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.config_store import ConfigStore

_CONFIG_KEY = "email_event_config"
_DEFAULT: dict[str, Any] = {
    "cutover_reminder": {
        "enabled": True,
        "reminder_days": [7, 3, 1],
        "run_time_utc": "09:00",
    }
}

_LAST_RUN_KEY = "email_cron_last_run"


async def get_email_event_config(session: AsyncSession) -> dict[str, Any]:
    row = await session.get(ConfigStore, _CONFIG_KEY)
    if row and isinstance(row.value, dict):
        # Merge with defaults so new keys are backfilled
        merged = dict(_DEFAULT)
        merged.update(row.value)
        return merged
    return dict(_DEFAULT)


async def set_email_event_config(
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


async def get_last_run(session: AsyncSession) -> datetime | None:
    row = await session.get(ConfigStore, _LAST_RUN_KEY)
    if row and isinstance(row.value, dict):
        ts = row.value.get("timestamp")
        if ts:
            return datetime.fromisoformat(ts)
    return None


async def set_last_run(session: AsyncSession, when: datetime | None = None) -> None:
    when = when or datetime.now(timezone.utc)
    row = await session.get(ConfigStore, _LAST_RUN_KEY)
    value = {"timestamp": when.isoformat()}
    if row:
        row.value = value
        flag_modified(row, "value")
    else:
        session.add(ConfigStore(key=_LAST_RUN_KEY, value=value))
    await session.flush()
