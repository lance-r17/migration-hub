# Backend Overview

> **Status: Not yet implemented.** This document describes the planned backend architecture. The frontend currently runs entirely on a client-side mock store.

## Stack

| Component | Technology |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI (async REST API, auto-generated OpenAPI docs) |
| ORM | SQLAlchemy (async) |
| Migrations | Alembic |
| Database | PostgreSQL 15+ |
| Background jobs | FastAPI `BackgroundTasks` or a dedicated worker (Celery/ARQ) |

## Planned structure

```
backend/
├── app/
│   ├── main.py             # FastAPI app factory
│   ├── api/
│   │   ├── v1/
│   │   │   ├── projects.py     # /api/v1/projects
│   │   │   ├── waves.py        # /api/v1/waves
│   │   │   ├── users.py        # /api/v1/users
│   │   │   ├── dashboard.py    # /api/v1/dashboard
│   │   │   └── audit_log.py    # /api/v1/projects/:id/audit-log
│   ├── models/             # SQLAlchemy ORM models
│   ├── schemas/            # Pydantic request/response schemas
│   ├── services/           # Business logic layer
│   │   ├── jira.py         # Jira API client
│   │   └── resource_scan.py  # Cloud provider resource scanning
│   ├── db.py               # Database session factory
│   └── config.py           # Settings (env-based with pydantic-settings)
├── alembic/
│   ├── env.py
│   └── versions/           # Migration scripts
├── requirements.txt
└── .env.example
```

## Key design principles

- **Async throughout**: Use `async def` for all route handlers and DB operations (`asyncpg` driver)
- **Pydantic schemas match frontend types**: The JSON shapes returned by the API must match the TypeScript interfaces in `frontend/src/types/`. See [../shared/data-model.md](../shared/data-model.md) for the canonical type definitions
- **Audit log as transaction side-effect**: Every write operation that modifies a project section should append an audit log row in the same database transaction — never rely on the frontend to create audit entries
- **Background jobs for Jira**: Issue creation should be offloaded to a background task so the sign-off endpoint returns immediately. The frontend polls `GET /api/v1/projects/:id` to observe job progress

## Environment variables (planned)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JIRA_BASE_URL` | Jira instance URL |
| `JIRA_API_TOKEN` | Jira API token |
| `JIRA_USER_EMAIL` | Email associated with the Jira API token |
| `JIRA_PROJECT_KEY` | Default Jira project key (e.g. `MIG`) |
| `CLOUD_PROVIDER` | Target cloud provider for resource scanning |

## API endpoint reference

See [api.md](api.md) for the full endpoint list derived from the frontend service layer.
