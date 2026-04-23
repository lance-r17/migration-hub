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
| `VITE_EMAIL_SERVER_URL` | _(empty)_ | URL of the local email relay server. Set to `http://localhost:3001` when running the email server. |
| `VITE_OIDC_ISSUER` | _(empty)_ | OIDC issuer URL. Leave empty for mock auth (default). See [SSO configuration](shared/sso-configuration.md). |
| `VITE_OIDC_CLIENT_ID` | _(empty)_ | OIDC application client ID. Required when `VITE_OIDC_ISSUER` is set. |
| `VITE_OIDC_REDIRECT_URI` | _(empty)_ | Post-login callback URL. Defaults to `{origin}/callback` when not set. |

**Mock mode (default):** leave `VITE_API_BASE_URL` unset. All data comes from the in-memory store seeded by `src/data/mock.ts`. No database or backend needed.

**Real API mode:** set `VITE_API_BASE_URL=http://localhost:8000` (or wherever the FastAPI server is running).

## Email server (optional)

The email server enables real SMTP email sending from the "Send Test" button in email template previews. It runs independently of the frontend.

### Setup

```bash
cd email-server
npm install
cp .env.example .env   # fill in your SMTP credentials
```

`.env` settings:

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port — `587` for TLS, `465` for SSL |
| `SMTP_SECURE` | `true` for port 465 (SSL), `false` for 587 (TLS) |
| `SMTP_USER` | Sender email address |
| `SMTP_PASS` | App password or SMTP password |
| `SMTP_FROM` | Display name + address (e.g. `Migration Hub <you@example.com>`) |

**Gmail quick start:** enable 2-factor auth, generate an App Password at `myaccount.google.com/apppasswords`, and use it as `SMTP_PASS`.

### Run

```bash
npm run dev   # starts on http://localhost:3001
```

Then add `VITE_EMAIL_SERVER_URL=http://localhost:3001` to `frontend/.env.local`. The rest of the app remains in mock mode.

## Login

In mock mode, any credentials work. The login form accepts an email and password; they are not validated against real credentials. The mock always returns the same "current user" from `src/data/mock.ts`.

## Dev container

A `.devcontainer/` configuration is included. If you open the repo in VS Code with the Dev Containers extension (or in GitHub Codespaces), the environment is set up automatically.

## Backend

The backend is a Python FastAPI application in `backend/`. The easiest way to run it is with Docker Compose (handles PostgreSQL automatically).

### Using Docker Compose (recommended)

```bash
cd backend
docker compose up -d db        # start postgres:16-alpine on :5432
alembic upgrade head           # create 13 tables
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
| `DATABASE_URL` | `postgresql+asyncpg://hub:hub_dev_secret@localhost/migration_hub` | PostgreSQL connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `CURRENT_USER_ID` | `u-current` | User returned by `GET /users/me` (no auth yet) |
| `JIRA_BASE_URL` | _(empty)_ | Jira instance URL (optional for Jira job testing) |
| `JIRA_API_TOKEN` | _(empty)_ | Jira API token |
| `JIRA_USER_EMAIL` | _(empty)_ | Email for Jira API auth |
| `OIDC_ISSUER` | _(empty)_ | OIDC issuer URL. Leave empty for mock auth. See [SSO configuration](shared/sso-configuration.md). |
| `OIDC_AUDIENCE` | `migration-hub` | Expected `aud` claim in JWTs. Must be set to your client ID for Azure AD. |
| `ENVIRONMENT` | `development` | `development` or `production` |

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
