# Backend Overview

## Stack

| Component | Technology |
|---|---|
| Language | Python 3.12 |
| Framework | FastAPI (async REST API, auto-generated OpenAPI docs at `/docs`) |
| ORM | SQLAlchemy 2.0 (async) |
| Driver | asyncpg |
| Migrations | Alembic |
| Database | PostgreSQL 16 |
| Background jobs | FastAPI `BackgroundTasks` (Jira job processing) |
| Config | pydantic-settings (reads from `.env`) |

## Directory structure

```
backend/
├── pyproject.toml          # dependencies (fastapi, sqlalchemy[asyncio], asyncpg, alembic, pydantic≥2)
├── alembic.ini
├── docker-compose.yml      # postgres:16-alpine + backend services
├── Dockerfile
├── alembic/
│   ├── env.py              # async migration runner
│   └── versions/
│       └── 0001_initial_schema.py   # hand-authored migration for all 13 tables
├── scripts/
│   ├── seed.py             # synchronous seeder (psycopg2); run with --force to re-seed
│   └── seed_data/          # JSON files: users, projects, waves, billing, embargos, survey configs
└── app/
    ├── main.py             # app factory, lifespan hook, router registration
    ├── config.py           # Settings(BaseSettings) — reads DATABASE_URL, CORS_ORIGINS, etc.
    ├── database.py         # async engine, AsyncSessionLocal, get_db dependency
    ├── data/               # static constants (survey_field_defs.py)
    ├── models/             # 13 SQLAlchemy model files + base.py (TimestampMixin)
    ├── schemas/            # Pydantic v2 schemas (ConfigDict from_attributes=True)
    ├── routers/            # FastAPI route files (one per domain)
    └── services/           # business logic layer (all take AsyncSession)
```

## Key design principles

- **Async throughout**: all route handlers and DB operations use `async def` with `asyncpg`
- **Pydantic schemas match frontend types**: JSON shapes returned by the API match the TypeScript interfaces in `frontend/src/types/`
- **JSONB for document-like sections**: project sections (`application_overview`, `availability`, `data_persistence`, `dependencies`, `nfrs`, `migration_constraints`, `target_architecture`, `team`) are stored as JSONB columns and patched atomically via `PATCH /api/v1/projects/:id/sections/:key`
- **Normalized tables for queryable entities**: `cloud_resources`, `risks`, `approvals`, `audit_log_entries`, and `project_users` are separate tables with FK to `projects`
- **Audit log as transaction side-effect**: every project write appends an `audit_log_entries` row in the same transaction — never triggered by the frontend
- **Background jobs for Jira**: `POST /api/v1/jira/jobs` returns 202 immediately; processing runs as a `BackgroundTask`. Stale `processing` jobs are reset to `failed` on startup

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://hub:hub_dev_secret@localhost/migration_hub` | PostgreSQL connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `CURRENT_USER_ID` | `u-current` | Fallback user returned by `GET /users/me` when no auth system is configured |
| `JIRA_BASE_URL` | _(empty)_ | Jira instance URL |
| `JIRA_API_TOKEN` | _(empty)_ | Jira API token |
| `JIRA_USER_EMAIL` | _(empty)_ | Email for Jira API auth |
| `OAUTH_SERVICE_URL` | _(empty)_ | Custom OAuth service base URL (see SSO configuration) |
| `OAUTH_CLIENT_ID` | `migration-hub` | Client ID registered with the OAuth service |
| `OAUTH_CLIENT_SECRET` | _(empty)_ | Client secret for backend-to-service userinfo calls |
| `SESSION_SECRET_KEY` | _(empty)_ | Secret key for signing backend session JWTs |
| `SESSION_MAX_AGE_MINUTES` | `480` | Session lifetime in minutes |
| `OIDC_ISSUER` | _(empty)_ | OIDC issuer URL (legacy, see SSO configuration) |
| `OIDC_AUDIENCE` | `migration-hub` | Expected `aud` claim in OIDC JWTs |
| `ENVIRONMENT` | `development` | `development` or `production` |

## Dev workflow

```bash
cd backend

# Start PostgreSQL (Docker Compose)
docker compose up -d db

# Apply migrations (creates all 13 tables)
alembic upgrade head

# Seed with mock data
python scripts/seed.py

# Run the API server
uvicorn app.main:app --reload   # http://localhost:8000
# OpenAPI docs: http://localhost:8000/docs
```

**Connect the frontend:**

```bash
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```

## API endpoint reference

See [api.md](api.md) for the full endpoint reference.

## Database schema

See [database.md](database.md) for the full table schema and index definitions.
