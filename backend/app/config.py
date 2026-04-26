import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_ca_bundle() -> str | bool:
    """Return the CA bundle path from standard env vars, or True for system defaults."""
    for key in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
        path = os.environ.get(key)
        if path:
            return path
    return True


HTTP_CLIENT_VERIFY = _resolve_ca_bundle()


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
    jira_issue_link_type: str = "Delivers"
    current_user_id: str = "u2"
    environment: str = "development"
    oidc_issuer: str = ""
    oidc_audience: str = "migration-hub"

    # Custom enterprise OAuth service settings
    oauth_service_url: str = ""
    oauth_client_id: str = "migration-hub"
    oauth_client_secret: str = "mock-secret-do-not-use-in-production"
    session_secret_key: str = "change-me-in-production"
    session_max_age_minutes: int = 480  # 8 hours

    # AD group → project auto-assignment
    oauth_ad_group_regex: str = r"CN=([^,]+)-ResourceSetReadOnly"
    oauth_ad_group_ou_filter: str = "OU=Ali"

    # AD group → global role mapping (JSON array of {"regex": "...", "role": "..."})
    oauth_role_mappings: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
