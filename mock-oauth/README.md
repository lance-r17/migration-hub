# Mock OAuth Service

A lightweight FastAPI service that simulates the real enterprise OAuth service for local development.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/v1/oauth/sso/authentication` | Renders a login form with mock users |
| `POST` | `/api/v1/oauth/sso/authentication` | Submits user selection, generates one-time code, redirects to callback |
| `POST` | `/api/v1/oauth/sso/userinfo` | Exchanges `client_id`, `client_secret`, `code` for user details |

## Run

### Standalone

```bash
cd mock-oauth
pip install fastapi uvicorn pydantic
uvicorn main:app --host 0.0.0.0 --port 5557
```

### Docker Compose (recommended)

The service is included in `backend/docker-compose.yml`:

```bash
cd backend && docker compose up mock-oauth
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_OAUTH_CLIENT_ID` | `migration-hub` | Expected client ID |
| `MOCK_OAUTH_CLIENT_SECRET` | `mock-secret-do-not-use-in-production` | Expected client secret |
| `MOCK_OAUTH_PORT` | `5557` | Listen port |

## Mock Users

All passwords are simulated by selecting the user in the form:

| ID | Email | Name |
|----|-------|------|
| `u-current` | henry.wilson@corp.com | Henry Wilson |
| `u3` | alice.johnson@corp.com | Alice Johnson |
| `u12` | karen.lee@corp.com | Karen Lee |
| `u2` | dan.brown@corp.com | Dan Brown |
