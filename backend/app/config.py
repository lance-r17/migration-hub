from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://hub:hub_dev_secret@localhost/migration_hub"
    cors_origins: str = "http://localhost:5173"
    jira_base_url: str = ""
    jira_api_token: str = ""
    jira_user_email: str = ""
    jira_project_key: str = "MIG"
    jira_subtask_issue_type: str = "Subtask"
    jira_subtask_issue_type_id: str = ""
    current_user_id: str = "u2"
    environment: str = "development"
    oidc_issuer: str = ""
    oidc_audience: str = "migration-hub"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
