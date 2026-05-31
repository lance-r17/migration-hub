from pydantic import BaseModel, ConfigDict


class PlatformPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


class CloudSetupPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


class MigrationSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    platform_period: PlatformPeriod | None = None
    new_cloud_setup_period: CloudSetupPeriod | None = None
    duration_options: list[int] = [15, 30, 45]
    gbi_tier_depth: int | None = None


class MigrationSettingsUpdate(BaseModel):
    platform_period: PlatformPeriod | None = None
    new_cloud_setup_period: CloudSetupPeriod | None = None
    duration_options: list[int] | None = None
    gbi_tier_depth: int | None = None
