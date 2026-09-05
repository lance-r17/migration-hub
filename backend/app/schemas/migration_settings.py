from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class ProgressWeights(BaseModel):
    """Configurable stage weights (percent). Migration weight is derived as
    100 - preparation; the preparation sub-weights must sum to preparation."""

    preparation: int = Field(default=30, ge=0, le=100)
    setup: int = Field(default=5, ge=0, le=100)
    survey: int = Field(default=15, ge=0, le=100)
    signoff: int = Field(default=10, ge=0, le=100)

    @model_validator(mode="after")
    def _sub_weights_sum_to_preparation(self):
        if self.setup + self.survey + self.signoff != self.preparation:
            raise ValueError(
                "setup + survey + signoff must equal the preparation weight"
            )
        return self


class MigrationSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    platform_period: PlatformPeriod | None = None
    new_cloud_setup_period: CloudSetupPeriod | None = None
    duration_options: list[int] = [15, 30, 45]
    bgi_tier_depth: int | None = None
    data_migration_adjustment_enabled: bool = True
    create_jira_stories_on_signoff: bool = True
    signoff_enabled: bool = True
    progress_weights: ProgressWeights = Field(default_factory=ProgressWeights)
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
    signoff_enabled: bool | None = None
    progress_weights: ProgressWeights | None = None
    data_migration: DataMigrationSettings | None = None
    provision_cidr_parents: ProvisionCidrParents | None = None
    provision_allowed_prefixes: list[int] | None = None


class DataMigrationCycleBlock(BaseModel):
    start_date: str
    end_date: str
    booked_count: int
    asr_dr_booked_count: int
