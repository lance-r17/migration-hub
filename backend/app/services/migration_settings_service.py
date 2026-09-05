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
    "data_migration_adjustment_enabled": True,
    "create_jira_stories_on_signoff": True,
    "signoff_enabled": True,
    "progress_weights": {"preparation": 30, "setup": 5, "survey": 15, "signoff": 10},
    "provision_allowed_prefixes": [25, 26, 27],
    "provision_cidr_parents": {
        "dev": {
            "zone_a": ["10.248.32.0/20", "10.248.48.0/20", "10.248.64.0/20"],
            "zone_b": ["10.248.160.0/20", "10.248.176.0/20", "10.248.192.0/20"],
            "zone_c": ["10.249.32.0/20", "10.249.48.0/20", "10.249.64.0/20"],
        },
        "prod": {
            "zone_a": ["10.248.80.0/20", "10.248.96.0/20", "10.248.112.0/20"],
            "zone_b": ["10.248.208.0/20", "10.248.224.0/20", "10.248.240.0/20"],
            "zone_c": ["10.249.80.0/20", "10.249.96.0/20", "10.249.112.0/20"],
        },
    },
    "data_migration": {
        "cycle_duration_days": 7,
        "min_cycle": 1,
        "max_cycle": 3,
        "min_dts_instance_count": 1,
        "max_dts_instance_count": 5,
        "cycle_period": None,
        "extended_adjustment_period": None,
        "cycle_capacity": 20,
        "asr_dr_license_capacity": 2,
        "support_email": None,
    },
}


def _default_data_migration() -> dict:
    return dict(_DEFAULT["data_migration"])


def _default_provision_cidr_parents() -> dict:
    import copy

    return copy.deepcopy(_DEFAULT["provision_cidr_parents"])


async def get_migration_settings(session: AsyncSession) -> MigrationSettingsOut:
    row = await session.get(ConfigStore, _KEY)
    data = row.value if row else dict(_DEFAULT)
    return MigrationSettingsOut(
        platform_period=data.get("platform_period"),
        new_cloud_setup_period=data.get("new_cloud_setup_period"),
        duration_options=data.get("duration_options", _DEFAULT["duration_options"]),
        bgi_tier_depth=data.get("bgi_tier_depth"),
        data_migration_adjustment_enabled=data.get("data_migration_adjustment_enabled", True),
        create_jira_stories_on_signoff=data.get("create_jira_stories_on_signoff", True),
        signoff_enabled=data.get("signoff_enabled", True),
        progress_weights=data.get("progress_weights", _DEFAULT["progress_weights"]),
        provision_cidr_parents=data.get(
            "provision_cidr_parents", _default_provision_cidr_parents()
        ),
        provision_allowed_prefixes=data.get("provision_allowed_prefixes", [25, 26, 27]),
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
    if patch.data_migration_adjustment_enabled is not None:
        current["data_migration_adjustment_enabled"] = patch.data_migration_adjustment_enabled
    if patch.create_jira_stories_on_signoff is not None:
        current["create_jira_stories_on_signoff"] = patch.create_jira_stories_on_signoff
    if patch.signoff_enabled is not None:
        current["signoff_enabled"] = patch.signoff_enabled
    if patch.progress_weights is not None:
        current["progress_weights"] = patch.progress_weights.model_dump()
    if patch.data_migration is not None:
        current["data_migration"] = patch.data_migration.model_dump()
    if patch.provision_cidr_parents is not None:
        current["provision_cidr_parents"] = patch.provision_cidr_parents.model_dump()
    if patch.provision_allowed_prefixes is not None:
        current["provision_allowed_prefixes"] = patch.provision_allowed_prefixes

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
        data_migration_adjustment_enabled=current.get(
            "data_migration_adjustment_enabled", True
        ),
        create_jira_stories_on_signoff=current.get("create_jira_stories_on_signoff", True),
        signoff_enabled=current.get("signoff_enabled", True),
        progress_weights=current.get("progress_weights", _DEFAULT["progress_weights"]),
        provision_cidr_parents=current.get(
            "provision_cidr_parents", _default_provision_cidr_parents()
        ),
        provision_allowed_prefixes=current.get("provision_allowed_prefixes", [25, 26, 27]),
        data_migration=current.get("data_migration", _default_data_migration()),
    )
