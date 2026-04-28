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
│       └── 0001_initial_schema.py   # hand-authored initial migration
├── scripts/
│   ├── seed.py             # synchronous seeder (psycopg2); run with --force to re-seed
│   └── seed_data/          # JSON files: users, projects, waves, billing, embargos, survey configs
└── app/
    ├── main.py             # app factory, lifespan hook, router registration
    ├── config.py           # Settings(BaseSettings) — reads DATABASE_URL, CORS_ORIGINS, etc.
    ├── database.py         # async engine, AsyncSessionLocal, get_db dependency
    ├── data/               # static constants (survey_field_defs.py)
    ├── models/             # SQLAlchemy model files + base.py (TimestampMixin)
    ├── schemas/            # Pydantic v2 schemas (ConfigDict from_attributes=True)
    ├── routers/            # FastAPI route files (one per domain)
    └── services/           # business logic layer (all take AsyncSession)
```

## Key design principles

- **Async throughout**: all route handlers and DB operations use `async def` with `asyncpg`
- **Pydantic schemas match frontend types**: JSON shapes returned by the API match the TypeScript interfaces in `frontend/src/types/`
- **JSONB for document-like sections**: project sections (`application_overview`, `availability`, `data_persistence`, `dependencies`, `nfrs`, `migration_constraints`, `target_architecture`, `migration_effort_estimation`, `planning`) are stored as JSONB columns and patched atomically via `PATCH /api/v1/projects/:id/sections/:key`
- **Normalized tables for queryable entities**: `cloud_resources`, `risks`, `approvals`, `audit_log_entries`, and `project_users` are separate tables with FK to `projects`
- **Audit log as transaction side-effect**: every project write appends an `audit_log_entries` row in the same transaction — never triggered by the frontend
- **Background jobs for Jira**: `POST /api/v1/jira/jobs` returns 202 immediately; processing runs as a `BackgroundTask`. Stale `processing` jobs are reset to `failed` on startup

## Environment variables

See [../getting-started.md](../getting-started.md) for the full environment variable reference. Key backend-specific variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `JIRA_BASE_URL` / `JIRA_API_TOKEN` / `JIRA_USER_EMAIL` | Jira REST API credentials |
| `OAUTH_SERVICE_URL` / `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` | Custom Enterprise OAuth |
| `SESSION_SECRET_KEY` / `SESSION_MAX_AGE_MINUTES` | Backend JWT signing |
| `OAUTH_AD_GROUP_REGEX` / `OAUTH_AD_GROUP_OU_FILTER` / `OAUTH_ROLE_MAPPINGS` | AD group synchronization |
| `OIDC_ISSUER` / `OIDC_AUDIENCE` | Standard OIDC (legacy) |
| `ENVIRONMENT` | `development` or `production` |

## Dev workflow

See [../getting-started.md](../getting-started.md) for step-by-step setup. Quick start:

```bash
cd backend
docker compose up -d db
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload
```

## API endpoint reference

See [api.md](api.md) for the full endpoint reference.

## Database schema

See [database.md](database.md) for the full table schema and index definitions.
