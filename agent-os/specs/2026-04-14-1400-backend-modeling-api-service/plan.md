# Backend Modeling & API Service — Full Plan

## Context

Migration Hub is currently a frontend-only SPA (React + Vite) running on an in-memory mock store. The tech stack document specifies a Python/FastAPI backend backed by PostgreSQL, but no `backend/` directory exists. The frontend `services/client.ts` already has a `USE_MOCK` toggle — setting `VITE_API_BASE_URL` switches all services from in-memory to real HTTP. The goal is to build the complete backend that the frontend was designed for: SQLAlchemy models, Pydantic schemas, Alembic migrations, FastAPI routers, service layer, seed data, and Docker Compose.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-14-1400-backend-modeling-api-service/` with `plan.md`, `shape.md`, `references.md`.

---

## Task 2: Project Scaffold & Core Infrastructure

Create `backend/` with:

```
backend/
├── pyproject.toml
├── .env.example
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── scripts/
│   ├── seed.py
│   └── seed_data/          (JSON files, one per domain)
└── app/
    ├── main.py
    ├── config.py
    ├── database.py
    ├── models/
    ├── schemas/
    ├── routers/
    └── services/
```

**`pyproject.toml` dependencies:**
```toml
[project.dependencies]
fastapi = ">=0.111"
uvicorn = {extras = ["standard"]}
sqlalchemy = {extras = ["asyncio"], version = ">=2.0"}
asyncpg = "*"          # async PostgreSQL driver
alembic = "*"
pydantic = ">=2.0"
pydantic-settings = "*"
httpx = "*"            # Jira API calls
```

**`app/config.py`** — `Settings(BaseSettings)` reads:
- `DATABASE_URL` (postgresql+asyncpg://...)
- `CORS_ORIGINS` (comma-separated, e.g. `http://localhost:5173`)
- `JIRA_BASE_URL`, `JIRA_API_TOKEN`, `JIRA_USER_EMAIL`
- `CURRENT_USER_ID` (controls which user `GET /users/me` returns; no auth system yet)
- `ENVIRONMENT` (development | production)

**`app/database.py`** — SQLAlchemy 2.0 async engine + `AsyncSession` + `get_db` dependency yielding a session.

**`app/main.py`** — `create_app()` factory; adds `CORSMiddleware`; registers all routers under `/api/v1`; startup hook resets any stalled `processing` Jira jobs to `failed`.

**`app/models/base.py`** — `Base = DeclarativeBase()` + `TimestampMixin(created_at, updated_at)`.

---

## Task 3: SQLAlchemy Models

Create `app/models/` — one file per domain. All use PostgreSQL `JSONB` (not `JSON`) for blob columns and `TIMESTAMPTZ` for all timestamps. `VARCHAR` enums preferred over PostgreSQL ENUM type (avoids Alembic pain on value additions).

### Normalization decisions

**Fully normalized tables:**

| Table | Notes |
|---|---|
| `users` | Queried independently; FK target for ProjectUser, Approval |
| `projects` | Core entity; TEXT PK to preserve frontend IDs (`PRJ-2024-ALPHA`) |
| `cloud_resources` | Individual row updates from Jira job; filtered by product/syncStatus |
| `waves` | Listed/patched independently |
| `project_users` | M2M projects↔users with role type |
| `risks` | CRUD with severity filter |
| `approvals` | Individual status updates per role |
| `audit_log_entries` | Appended per write; queried by projectId desc |
| `embargo_records` | Full CRUD |
| `billing_records` | Composite PK (month, env, resource_set) |
| `jira_jobs` | Polled by id; status written back |
| `config_store` | Singleton key→JSONB table for survey/billing configs |

**JSONB fields within parent tables:**

| Column | Parent | Reason |
|---|---|---|
| `application_overview` | projects | Complex struct; patched as atomic section |
| `availability` | projects | Same pattern |
| `data_persistence` | projects | Same pattern |
| `dependencies` | projects | Upstream/downstream arrays; no cross-project query |
| `nfrs` | projects | Same pattern |
| `migration_constraints` | projects | Nested arrays (freeze periods, windows) |
| `target_architecture` | projects | Same pattern |
| `team` | projects | `TeamMember[]` display cache; source of truth is `project_users` |
| `specs` | cloud_resources | Schema varies per product (ecs, rds, redis, oss…) |
| `config` | jira_jobs | `JiraSubtaskConfig` blob |
| `subtask_keys` | jira_jobs | `{key → jiraKey}` map |
| `actor` | audit_log_entries | Point-in-time snapshot; not a live FK |
| `changes` | audit_log_entries | `AuditChange[]` diff array |
| `affected_service_lines` | embargo_records | String array; never server-filtered |
| `value` | config_store | Entire config object (survey, resource-survey, billing thresholds) |

### Key model files

**`app/models/project.py`**
```python
class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    id: str  # TEXT PK
    name: str
    status: str  # planning|in-progress|migrating|blocked|signed-off|completed
    progress: int
    description: str | None
    wave_id: UUID | None  # FK waves.id
    jira_ticket: str | None
    jira_base_url: str | None
    jira_story_key: str | None
    jira_job_status: str | None
    # JSONB section columns:
    application_overview: dict
    availability: dict
    data_persistence: dict
    dependencies: dict
    nfrs: dict
    migration_constraints: dict
    target_architecture: dict
    team: list  # TeamMember[] display cache
    # Relationships:
    cloud_resources: list[CloudResource]
    risks: list[Risk]
    approvals: list[Approval]
    audit_logs: list[AuditLogEntry]
    project_users: list[ProjectUser]
```

**`app/models/cloud_resource.py`**
```python
class CloudResource(Base):
    __tablename__ = "cloud_resources"
    id: str  # TEXT PK (matches frontend IDs)
    project_id: str  # FK projects.id
    resource_id: str | None
    name: str
    product: str | None  # ecs|rds|polarDB|redis|oss|slb|dns|sls
    resource_set: str | None
    specs: dict  # JSONB — varies by product
    sub_application: str | None
    target_resource_id: str | None
    sync_status: str  # synced|out-of-sync|provisioning
    need_migration: bool = True
    jira_subtask_key: str | None
```

**`app/models/config_store.py`**
```python
class ConfigStore(Base):
    __tablename__ = "config_store"
    key: str  # PK — survey_config | resource_survey_config | billing_threshold_config
    value: dict  # JSONB
    updated_at: datetime
```

Indexes to add in migration:
- `ix_cloud_resources_project_id`
- `ix_audit_log_entries_project_id`
- `ix_billing_records_month_env`
- `ix_jira_jobs_project_id`

---

## Task 4: Pydantic v2 Schemas

Create `app/schemas/` — one file per domain. Mirror the TypeScript type shapes from `frontend/src/types/index.ts` and `frontend/src/types/wave.ts`, `audit.ts`, etc.

Key schema patterns:
- `ProjectListItem` — lightweight (id, name, status, progress, team, approvals summary); returned by `GET /projects`
- `ProjectDetail` — full; all JSONB sections expanded as nested Pydantic models
- `ProjectPatch` — top-level field patch (status, progress, waveId, etc.)
- `SectionPatch` — `{ value: Any }` for section-level replace
- `UserOut` — flat user shape matching frontend `User` type
- `WaveCreate` / `WaveOut` with `JiraSubtaskConfig` nested model
- `AuditLogEntryOut` with `AuditActor` and `AuditChange[]` nested

All schemas use `model_config = ConfigDict(from_attributes=True)` for ORM mode.

---

## Task 5: Alembic Migration

**`alembic/env.py`** — imports `Base.metadata` from `app/models/__init__.py`; uses `run_async_migrations()` pattern for async engine.

**`alembic/versions/0001_initial_schema.py`** — hand-authored (not autogenerated) for clarity. Table creation order follows FK dependencies:

1. `users`
2. `waves`
3. `projects` (FK → waves)
4. `project_users` (FK → projects, users)
5. `cloud_resources` (FK → projects)
6. `risks` (FK → projects)
7. `approvals` (FK → projects)
8. `audit_log_entries` (FK → projects)
9. `embargo_records`
10. `billing_records` — composite PK `(month, env, resource_set)`
11. `jira_jobs` (FK → projects)
12. `config_store`

Run: `alembic upgrade head`

---

## Task 6: FastAPI Routers

Create `app/routers/` — one file per domain, all registered in `main.py` under `/api/v1`.

### Complete API surface (from actual frontend service files)

```
# Projects
GET    /api/v1/projects                          ← projects.ts
POST   /api/v1/projects
GET    /api/v1/projects/{id}
PATCH  /api/v1/projects/{id}
PATCH  /api/v1/projects/{id}/sections/{key}
GET    /api/v1/projects/{id}/audit-log           ← auditLog.ts

# Waves
GET    /api/v1/waves                             ← waves.ts
POST   /api/v1/waves
GET    /api/v1/waves/{id}
PATCH  /api/v1/waves/{id}
POST   /api/v1/waves/import

# Users & Auth
GET    /api/v1/users                             ← users.ts
GET    /api/v1/users/me
POST   /api/v1/auth/login                        ← users.ts (mock toggle bypassed)

# Dashboard
GET    /api/v1/dashboard/stats                   ← dashboard.ts
GET    /api/v1/dashboard/activity

# Survey (note: /settings/ prefix)
GET    /api/v1/settings/survey                   ← surveyService.ts
PUT    /api/v1/settings/survey
GET    /api/v1/settings/survey/field-defs        ← returns static SURVEY_FIELD_DEFS constant
GET    /api/v1/settings/resource-survey
PUT    /api/v1/settings/resource-survey

# Embargos
GET    /api/v1/embargos                          ← embargos.ts
POST   /api/v1/embargos
PUT    /api/v1/embargos/{id}
DELETE /api/v1/embargos/{id}

# Billing
GET    /api/v1/billing/months?env=...            ← billing.ts
GET    /api/v1/billing?month=...&env=...
POST   /api/v1/billing

# Billing Config (note: /settings/ prefix)
GET    /api/v1/settings/billing-thresholds       ← billingConfig.ts
PUT    /api/v1/settings/billing-thresholds

# Product Categories
GET    /api/v1/product-category-map              ← productCategory.ts

# Email Templates (no USE_MOCK toggle; always hits HTTP)
GET    /api/v1/email-templates                   ← emailService.ts
POST   /api/v1/email-templates
POST   /api/v1/email-templates/send-test

# Jira Jobs (currently always mock — jiraJobs.ts bypasses apiClient entirely)
# Define endpoints for future frontend wiring:
POST   /api/v1/jira/jobs
GET    /api/v1/jira/jobs/{id}
```

### Key router implementation notes

**Projects — section patch routing:**
```python
SECTION_COLUMN_MAP = {
    "applicationOverview": "application_overview",
    "availability": "availability",
    "dataPersistence": "data_persistence",
    "dependencies": "dependencies",
    "nfrs": "nfrs",
    "migrationConstraints": "migration_constraints",
    "targetArchitecture": "target_architecture",
    "team": "team",
    "currentInfrastructure": None,  # handled specially → cloud_resources table
    "risks": None,                  # handled specially → risks table
    "approvals": None,              # handled specially → approvals table
}
```

For `currentInfrastructure`, `risks`, `approvals` — the section patch endpoint delegates to the respective table's service rather than writing JSONB.

**Billing — POST upsert semantics:**
The `POST /api/v1/billing` body is `BillingUpload { month, env, records[] }`. The service deletes all existing rows for `(month, env)` then inserts the new batch — wrapped in a single transaction. This matches the mock's `setBillingRecords` semantics.

**Survey field-defs — static constant:**
`GET /api/v1/settings/survey/field-defs` returns a hardcoded Python list in `app/data/survey_field_defs.py`. No DB backing — these only change with releases.

**Jira jobs — BackgroundTasks:**
`POST /api/v1/jira/jobs` → creates job record (status: `pending`) → adds `BackgroundTasks.add_task(process_jira_job, job_id)` → returns 202. Background task mirrors the mock's 30s flow: `pending` → `processing` → generate keys → write back to `cloud_resources` + `project` → `completed|failed`. Startup hook resets any stale `processing` jobs to `failed`.

**Auth — no JWT yet:**
`POST /api/v1/auth/login` accepts `{ email, password }` and returns the matching User row (no password hashing at this stage — passwords not stored). `GET /api/v1/users/me` returns the user whose `id == settings.CURRENT_USER_ID`. Actor for audit log uses this same resolved user.

---

## Task 7: Service Layer

Create `app/services/` — business logic separated from route handlers. All services accept an `AsyncSession` as first argument (injected via `get_db` dependency).

Key services:

**`project_service.py`**
- `get_projects(session, user_id=None)` — filter by user if provided
- `get_project(session, id)` — full join with resources/risks/approvals
- `update_project(session, id, patch, actor)` — patches top-level fields; appends audit entry
- `update_section(session, id, section_key, value, actor)` — writes JSONB column (or delegates to sub-service for relational sections); appends audit entry

**`audit_service.py`**
- `append_entry(session, project_id, event_type, entity_type, actor, changes, ...)` — called as transaction side-effect from all project writes

**`jira_service.py`**
- `process_jira_job(job_id)` — creates its own DB session (runs outside request lifecycle in BackgroundTask); mimics the mock's key generation logic

**`billing_service.py`**
- `upsert_billing_records(session, month, env, records)` — delete-then-insert in transaction

**`dashboard_service.py`**
- `compute_stats(session)` — aggregation queries across projects + cloud_resources
- `get_recent_activity(session, limit=20)` — queries audit_log_entries desc

---

## Task 8: Seed Data & Script

**`scripts/seed_data/`** — JSON files manually extracted from `frontend/src/data/mock.ts` (1158 lines):

- `users.json` — 15 users + 1 current user
- `projects.json` — 3 projects with nested resources, risks, approvals, all sections
- `waves.json` — mock waves
- `project_users.json` — ProjectUsers mappings
- `audit_log.json` — all audit entries (flattened, projectId included)
- `embargos.json` — embargo records
- `billing_existing.json` + `billing_target.json` — monthly records by month
- `survey_config.json` — survey questions
- `resource_survey_config.json` — resource survey groups
- `billing_threshold_config.json` — threshold values

**`scripts/seed.py`** — synchronous SQLAlchemy session (simpler for one-off scripts). Checks `SELECT COUNT(*) FROM users > 0` before seeding (skip unless `--force`). Insert order follows FK dependencies. Invoked as `python scripts/seed.py [--force]`.

---

## Task 9: Docker Compose & Dev Setup

**`docker-compose.yml`:**
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: migration_hub
      POSTGRES_USER: hub
      POSTGRES_PASSWORD: hub_dev_secret
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "hub"]
      interval: 5s
      retries: 5

  backend:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+asyncpg://hub:hub_dev_secret@db/migration_hub
      CORS_ORIGINS: http://localhost:5173
      CURRENT_USER_ID: u-platform-1
    ports: ["8000:8000"]
    volumes: [.:/app]
    depends_on:
      db: {condition: service_healthy}

volumes:
  pgdata:
```

**`Dockerfile`:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e ".[dev]"
COPY . .
```

**`.env.example`:**
```
DATABASE_URL=postgresql+asyncpg://hub:hub_dev_secret@localhost/migration_hub
CORS_ORIGINS=http://localhost:5173
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_API_TOKEN=
JIRA_USER_EMAIL=
CURRENT_USER_ID=u-platform-1
ENVIRONMENT=development
```

**Local dev workflow:**
```sh
cd backend
docker compose up -d db
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload
# in frontend:
# VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

---

## Critical Files to Reference During Implementation

| File | Purpose |
|---|---|
| `frontend/src/services/client.ts` | Auth HTTP method + path for every domain |
| `frontend/src/services/*.ts` | Exact endpoint paths (authoritative contract) |
| `frontend/src/types/index.ts` | TypeScript types → Pydantic schema shapes |
| `frontend/src/types/wave.ts` | Wave + JiraSubtaskConfig types |
| `frontend/src/types/audit.ts` | AuditLogEntry + AuditActor + AuditChange |
| `frontend/src/data/mock.ts` | Seed data source (1158 lines) |
| `frontend/src/data/store.ts` | Business logic reference — maps to service layer |
| `frontend/src/services/jiraJobs.ts` | Jira job flow logic to replicate in BackgroundTask |
| `frontend/src/services/surveyService.ts` | `/settings/` prefix + batch resource spec endpoint |

---

## Risks & Known Gaps

1. **jiraJobs.ts bypasses apiClient** — `createJiraJob` calls `store` directly; frontend won't use `/api/v1/jira/jobs` until that service is refactored. Backend endpoint is defined but frontend wiring is a separate task.

2. **No authentication** — `GET /users/me` returns `CURRENT_USER_ID` from config. Audit actor uses this user. JWT/OAuth wiring is a future task; service layer accepts `actor_user_id` param to make auth wiring non-breaking later.

3. **BackgroundTasks vs queue** — Jira job processing uses FastAPI `BackgroundTasks` (same process). Stale `processing` jobs reset to `failed` on startup. Celery/ARQ is the production upgrade path.

4. **Section patch atomicity** — `PATCH /projects/{id}/sections/{key}` replaces the full JSONB column; concurrent edits to different fields in the same section will silently overwrite each other. Acceptable for v1.

5. **Project IDs are TEXT** — matches frontend IDs (`PRJ-2024-ALPHA`). Slightly less efficient FK indexes than UUID but fine at expected project counts.

---

## Verification

1. `docker compose up -d` — postgres comes up healthy
2. `alembic upgrade head` — all 12 tables created with correct columns
3. `python scripts/seed.py` — 3 projects, 15 users, waves, billing, survey, embargos inserted
4. `uvicorn app.main:app --reload` — server starts, OpenAPI at `http://localhost:8000/docs`
5. Verify key endpoints manually via Swagger UI:
   - `GET /api/v1/projects` → 3 projects returned
   - `GET /api/v1/projects/PRJ-2024-ALPHA` → full project detail with resources/risks/approvals
   - `PATCH /api/v1/projects/PRJ-2024-ALPHA/sections/applicationOverview` → section updated, audit entry created
   - `GET /api/v1/projects/PRJ-2024-ALPHA/audit-log` → entries returned
   - `GET /api/v1/settings/survey` → survey config returned
   - `GET /api/v1/billing/months?env=existing` → months list
   - `POST /api/v1/jira/jobs` → 202, job created, background task runs
6. Set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local` and `npm run dev` — full app operates against real backend with no frontend code changes
