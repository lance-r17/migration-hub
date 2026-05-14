# Getting Started

## Prerequisites

- Node.js 20+ and npm
- Git

For backend development:
- Python 3.12+
- Docker and Docker Compose (recommended for PostgreSQL) or PostgreSQL 16+ installed locally

## Frontend (current)

### Install

```bash
cd frontend
npm install
```

### Run the dev server

```bash
npm run dev
```

The app starts at `http://localhost:5173` (or the port Vite selects). It binds to all interfaces (`--host`) so it works inside Docker / dev containers.

### Build for production

```bash
npm run build      # type-check + Vite bundle → dist/
npm run preview    # preview the production build locally
```

### Lint

```bash
npm run lint
```

### E2E tests

```bash
# First time: install Chromium browser
npx playwright install chromium

# Run all tests (headless, spins up Vite automatically)
npm run test:e2e

# Interactive UI mode (useful for debugging)
npm run test:e2e:ui
```

46 tests cover auth, navigation, wave planning, cloud resources, and RBAC.
See [docs/frontend/testing.md](frontend/testing.md) for the full test reference.

## Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | _(empty)_ | Base URL for the backend API. Leave empty to run on mock data. |
| `VITE_OAUTH_SERVICE_URL` | _(empty)_ | Custom OAuth service base URL. Leave empty for mock auth (default). See [SSO configuration](shared/sso-configuration.md). |
| `VITE_OAUTH_CLIENT_ID` | _(empty)_ | OAuth client ID. Required when `VITE_OAUTH_SERVICE_URL` is set. |
| `VITE_OAUTH_REDIRECT_URI` | _(empty)_ | Post-login callback URL. Defaults to `{origin}/callback` when not set. |
| `VITE_OIDC_ISSUER` | _(empty)_ | OIDC issuer URL (legacy). See [SSO configuration](shared/sso-configuration.md). |
| `VITE_OIDC_CLIENT_ID` | _(empty)_ | OIDC application client ID. Required when `VITE_OIDC_ISSUER` is set. |
| `VITE_OIDC_REDIRECT_URI` | _(empty)_ | Post-login callback URL. Defaults to `{origin}/callback` when not set. |

**Mock mode (default):** leave `VITE_API_BASE_URL` unset. All data comes from the in-memory store seeded by `src/data/mock.ts`. No database or backend needed.

**Real API mode:** set `VITE_API_BASE_URL=http://localhost:8000` (or wherever the FastAPI server is running).

## Email sending

Real SMTP email sending (e.g. test emails from the email template preview) is handled by the backend. Configure SMTP settings in the backend `.env` file.

### Backend SMTP settings

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port — `587` for TLS, `465` for SSL |
| `SMTP_SECURE` | `true` for TLS on connect, `false` for STARTTLS (default `false`) |
| `SMTP_USER` | Sender email address |
| `SMTP_PASSWORD` | App password or SMTP password |
| `SMTP_FROM` | Display name + address (e.g. `Migration Hub <you@example.com>`) |

**Gmail quick start:** enable 2-factor auth, generate an App Password at `myaccount.google.com/apppasswords`, and use it as `SMTP_PASSWORD`.

No frontend configuration is required — the frontend always calls the backend API for email sends.

## Login

In mock mode, any credentials work. The login form accepts an email and password; they are not validated against real credentials. The mock always returns the same "current user" from `src/data/mock.ts`.

When `VITE_OAUTH_SERVICE_URL` is set, clicking "Login with Enterprise SSO" redirects to the OAuth service. After authentication, the OAuth service redirects back to `/callback` with a one-time code. The frontend exchanges this code with the backend (`POST /api/v1/auth/sso/exchange`), which calls the OAuth service's `/userinfo` endpoint using `client_secret`, looks up the user by email, and issues a backend-signed JWT session token. See [SSO configuration](shared/sso-configuration.md) for full details.

## Dev container

A `.devcontainer/` configuration is included. If you open the repo in VS Code with the Dev Containers extension (or in GitHub Codespaces), the environment is set up automatically.

## Backend

The backend is a Python FastAPI application in `backend/`. The easiest way to run it is with Docker Compose (handles PostgreSQL automatically).

### Using Docker Compose (recommended)

```bash
cd backend
docker compose up -d db        # start postgres:16-alpine on :5432
alembic upgrade head           # apply all migrations
python scripts/seed.py         # load seed data (projects, users, waves, etc.)
uvicorn app.main:app --reload  # FastAPI on :8000
```

To run both the database and backend together:

```bash
docker compose up              # db + backend on :8000
```

### Manual setup (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && pip install psycopg2-binary
cp .env.example .env           # edit DATABASE_URL to point at your local postgres
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload  # http://localhost:8000
```

### Backend environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://hub:<YOUR_DB_PASSWORD>@localhost/migration_hub` | PostgreSQL connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `CURRENT_USER_ID` | `u-current` | Fallback user returned by `GET /users/me` in mock auth mode |
| `JIRA_BASE_URL` | _(empty)_ | Jira instance URL (optional for Jira job testing) |
| `JIRA_API_TOKEN` | _(empty)_ | Jira API token |
| `JIRA_USER_EMAIL` | _(empty)_ | Email for Jira API auth |
| `SMTP_HOST` | _(empty)_ | SMTP server hostname for sending emails |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS on connect (`true` for port 465) |
| `SMTP_USER` | _(empty)_ | SMTP username / sender address |
| `SMTP_PASSWORD` | _(empty)_ | SMTP password or app password |
| `SMTP_FROM` | _(empty)_ | From address display name (defaults to `SMTP_USER`) |
| `CONSOLE_EMAIL` | `false` | Print emails to backend log instead of sending via SMTP. Useful for dev when no SMTP server is available. |
| `OAUTH_SERVICE_URL` | _(empty)_ | Custom OAuth service base URL. Leave empty for mock auth. See [SSO configuration](shared/sso-configuration.md). |
| `OAUTH_CLIENT_ID` | `migration-hub` | Client ID registered with the OAuth service. |
| `OAUTH_CLIENT_SECRET` | _(empty)_ | Client secret for backend-to-OAuth-service `/userinfo` calls. |
| `SESSION_SECRET_KEY` | _(empty)_ | Secret key for signing backend session JWTs (HS256). |
| `SESSION_MAX_AGE_MINUTES` | `480` | Session lifetime in minutes (default 8 hours). |
| `OAUTH_AD_GROUP_REGEX` | `CN=([^,]+)-ResourceSetReadOnly` | Regex to extract project ID from AD group DN. Used when `OAUTH_AD_GROUP_MAPPINGS` is empty. |
| `OAUTH_AD_GROUP_OU_FILTER` | `OU=Ali` | Substring filter for relevant AD groups. |
| `OAUTH_AD_GROUP_MAPPINGS` | _(empty)_ | JSON array of `{"regex": "...", "project_id": "..."}` for flexible project assignment. `project_id` supports `$1`, `$2`, etc. capture group substitution. Overrides `OAUTH_AD_GROUP_REGEX` when set. |
| `OAUTH_ROLE_MAPPINGS` | _(empty)_ | JSON array of `{"regex": "...", "role": "..."}` for global role assignment. |
| `OIDC_ISSUER` | _(empty)_ | OIDC issuer URL (legacy). See [SSO configuration](shared/sso-configuration.md). |
| `OIDC_AUDIENCE` | `migration-hub` | Expected `aud` claim in OIDC JWTs. Must be set to your client ID for Azure AD. |
| `ENVIRONMENT` | `development` | `development` or `production` |

### Running the backend container

When running the pre-built Docker image (e.g. from Nexus), **environment variables are injected at runtime** — the `.env` file is not baked into the image (excluded by `.dockerignore` for security).

**Use `.env.docker`, not `.env`.** Inside a Docker container, `localhost` refers to the container itself. The `.env.docker` file replaces `localhost` with Docker Compose service names (`db` for PostgreSQL, `mock-oauth` for the OAuth service, etc.).

```bash
cd backend

# Put the container on the same Docker network as PostgreSQL
docker run -d \
  --name backend-runtime \
  --network backend_default \
  --env-file .env.docker \
  -p 8000:8000 \
  nexus.company.com/docker-hosted/migration-hub/backend:latest
```

**Why `--network backend_default` is required:** Docker's internal DNS resolves service names (like `db`) only within containers on the same network. Without this, `db` won't resolve and you'll get `ConnectionRefusedError`.

**Hostnames inside a container:**

| Service | In `.env` (local dev) | In `.env.docker` (container) |
|---|---|---|
| PostgreSQL | `localhost:5432` | `db:5432` |
| Mock OAuth | `localhost:5557` | `mock-oauth:5557` |
| Dex (OIDC) | `localhost:5556` | `dex:5556` |

Required: `DATABASE_URL`. Conditionally required: `OAUTH_CLIENT_SECRET` and `SESSION_SECRET_KEY` when `OAUTH_SERVICE_URL` is set. See `backend/.env.example` for all variables. See [Docker build & push](backend/docker-build-push.md) for the full runtime environment reference.

### Connect the frontend to the backend

```bash
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev   # all service calls now hit the real API
```

OpenAPI docs are available at `http://localhost:8000/docs` while the backend is running.

### Seed script

`python scripts/seed.py` inserts all mock data (projects, users, waves, billing records, survey config, embargos). It skips if data already exists. Use `--force` to clear and re-seed:

```bash
python scripts/seed.py --force
```
