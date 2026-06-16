from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.config_store import ConfigStore
from app.schemas.migration_settings import (
    DataMigrationSettings,
    MigrationSettingsOut,
    MigrationSettingsUpdate,
)

_KEY = "migration_settings"
_DEFAULT = {
    "platform_period": None,
    "new_cloud_setup_period": {"start_date": "2026-04-01", "end_date": "2026-12-12"},
    "duration_options": [15, 30, 45],
    "bgi_tier_depth": None,
    "data_migration": {
        "cycle_duration_days": 7,
        "min_cycle": 1,
        "max_cycle": 3,
        "min_dts_instance_count": 1,
        "max_dts_instance_count": 5,
        "cycle_period": None,
        "cycle_capacity": 20,
    },
}


def _default_data_migration() -> dict:
    return dict(_DEFAULT["data_migration"])


async def get_migration_settings(session: AsyncSession) -> MigrationSettingsOut:
    row = await session.get(ConfigStore, _KEY)
    data = row.value if row else dict(_DEFAULT)
    return MigrationSettingsOut(
        platform_period=data.get("platform_period"),
        new_cloud_setup_period=data.get("new_cloud_setup_period"),
        duration_options=data.get("duration_options", _DEFAULT["duration_options"]),
        bgi_tier_depth=data.get("bgi_tier_depth"),
        data_migration=data.get("data_migration", _default_data_migration()),
    )


async def update_migration_settings(
    session: AsyncSession, patch: MigrationSettingsUpdate
) -> MigrationSettingsOut:
    row = await session.get(ConfigStore, _KEY)
    current = row.value if row else dict(_DEFAULT)

    if patch.platform_period is not None:
        current["platform_period"] = (
            patch.platform_period.model_dump() if patch.platform_period else None
        )
    if patch.new_cloud_setup_period is not None:
        current["new_cloud_setup_period"] = (
            patch.new_cloud_setup_period.model_dump() if patch.new_cloud_setup_period else None
        )
    if patch.duration_options is not None:
        current["duration_options"] = patch.duration_options
    if "bgi_tier_depth" in patch.model_fields_set:
        current["bgi_tier_depth"] = patch.bgi_tier_depth
    if patch.data_migration is not None:
        current["data_migration"] = patch.data_migration.model_dump()

    if row:
        row.value = current
        flag_modified(row, "value")
    else:
        session.add(ConfigStore(key=_KEY, value=current))

    await session.flush()
    return MigrationSettingsOut(
        platform_period=current.get("platform_period"),
        new_cloud_setup_period=current.get("new_cloud_setup_period"),
        duration_options=current.get("duration_options", _DEFAULT["duration_options"]),
        bgi_tier_depth=current.get("bgi_tier_depth"),
        data_migration=current.get("data_migration", _default_data_migration()),
    )
