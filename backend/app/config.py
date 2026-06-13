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

    database_url: str = ""
    cors_origins: str = "http://localhost:5173"
    jira_base_url: str = ""
    jira_api_token: str = ""
    jira_user_email: str = ""
    jira_project_key: str = "MIG"
    jira_subtask_issue_type: str = "Subtask"
    jira_subtask_issue_type_id: str = ""
    jira_issue_link_type: str = "Delivers"
    jira_api_version: str = "3"
    current_user_id: str = "u2"
    environment: str = "development"
    oidc_issuer: str = ""
    oidc_audience: str = "migration-hub"

    # Custom enterprise OAuth service settings
    oauth_service_url: str = ""
    oauth_client_id: str = "migration-hub"
    oauth_client_secret: str = ""
    session_secret_key: str = ""
    session_max_age_minutes: int = 480  # 8 hours

    # AD group → project auto-assignment
    # Legacy single-regex mode (used when oauth_ad_group_mappings is empty)
    oauth_ad_group_regex: str = r"CN=([^,]+)-ResourceSetReadOnly"
    oauth_ad_group_ou_filter: str = "OU=Ali"

    # Flexible AD group → project mapping (JSON array of {"regex": "...", "project_id": "..."})
    # project_id supports capture group substitution: $1, $2, etc.
    # Example: [{"regex": "CN=([^,]+)-dev-ResourceSetReadOnly", "project_id": "$1-prod"}]
    oauth_ad_group_mappings: str = ""

    # AD group → global role mapping (JSON array of {"regex": "...", "role": "..."})
    oauth_role_mappings: str = ""

    # Kubernetes deployment: API pods should not run background tasks
    disable_background_tasks: bool = False

    # SMTP / email settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    # Platform branding for email footers
    platform_name: str = "Migration Engine"
    platform_url: str = ""
    email_banner_url: str = "/email-banner.png"

    console_email: bool = False  # Log emails to stdout instead of sending (dev mode)

    # Confluence integration
    confluence_base_url: str = ""
    confluence_api_token: str = ""
    confluence_user_email: str = ""
    confluence_space_key: str = ""
    # 'basic' (default, Cloud + DC with username/password) or 'bearer' (DC Personal Access Token)
    confluence_auth_type: str = "basic"

    # Zoom Server-to-Server OAuth
    zoom_account_id: str = ""
    zoom_client_id: str = ""
    zoom_client_secret: str = ""

    # New project ID mapping validation regex (applied to applicationOverview.newProjectId)
    new_project_id_regex: str = ""

    @property
    def confluence_api_base(self) -> str:
        return self.confluence_base_url.rstrip("/")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

# Optional startup diagnostics
if settings.new_project_id_regex:
    print(f"NEW_PROJECT_ID_REGEX configured: {settings.new_project_id_regex}")

# Validate required secrets at startup
if not settings.database_url:
    raise ValueError("DATABASE_URL must be set")

if settings.oauth_service_url:
    if not settings.oauth_client_secret:
        raise ValueError("OAUTH_CLIENT_SECRET must be set when OAUTH_SERVICE_URL is configured")
    if not settings.session_secret_key:
        raise ValueError("SESSION_SECRET_KEY must be set when OAUTH_SERVICE_URL is configured")
