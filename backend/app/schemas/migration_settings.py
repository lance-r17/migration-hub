from pydantic import BaseModel, ConfigDict, Field


class PlatformPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


class CloudSetupPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


class DataMigrationPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


class DataMigrationSettings(BaseModel):
    cycle_duration_days: int = 7
    min_cycle: int = 1
    max_cycle: int = 3
    min_dts_instance_count: int = 1
    max_dts_instance_count: int = 5
    cycle_period: DataMigrationPeriod | None = None
    extended_adjustment_period: DataMigrationPeriod | None = None
    cycle_capacity: int = 20
    asr_dr_license_capacity: int = 2
    support_email: str | None = None


class ProvisionCidrZoneMap(BaseModel):
    zone_a: list[str] = []
    zone_b: list[str] = []
    zone_c: list[str] = []


class ProvisionCidrParents(BaseModel):
    dev: ProvisionCidrZoneMap = Field(default_factory=ProvisionCidrZoneMap)
    prod: ProvisionCidrZoneMap = Field(default_factory=ProvisionCidrZoneMap)


class MigrationSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    platform_period: PlatformPeriod | None = None
    new_cloud_setup_period: CloudSetupPeriod | None = None
    duration_options: list[int] = [15, 30, 45]
    bgi_tier_depth: int | None = None
    data_migration_adjustment_enabled: bool = True
    create_jira_stories_on_signoff: bool = True
    data_migration: DataMigrationSettings = Field(default_factory=DataMigrationSettings)
    provision_cidr_parents: ProvisionCidrParents = Field(default_factory=ProvisionCidrParents)
    provision_allowed_prefixes: list[int] = [25, 26, 27]


class MigrationSettingsUpdate(BaseModel):
    platform_period: PlatformPeriod | None = None
    new_cloud_setup_period: CloudSetupPeriod | None = None
    duration_options: list[int] | None = None
    bgi_tier_depth: int | None = None
    data_migration_adjustment_enabled: bool | None = None
    create_jira_stories_on_signoff: bool | None = None
    data_migration: DataMigrationSettings | None = None
    provision_cidr_parents: ProvisionCidrParents | None = None
    provision_allowed_prefixes: list[int] | None = None


class DataMigrationCycleBlock(BaseModel):
    start_date: str
    end_date: str
    booked_count: int
    asr_dr_booked_count: int
