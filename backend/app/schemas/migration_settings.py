from pydantic import BaseModel, ConfigDict


class PlatformPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


class MigrationSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    platform_period: PlatformPeriod | None = None
    duration_options: list[int] = [15, 30, 45]


class MigrationSettingsUpdate(BaseModel):
    platform_period: PlatformPeriod | None = None
    duration_options: list[int] | None = None
