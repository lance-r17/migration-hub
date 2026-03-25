# Database

> **Status: Not yet implemented.** This document describes the planned database schema. It is derived from the frontend data model in [../shared/data-model.md](../shared/data-model.md).

## Technology

- **PostgreSQL 15+** — Primary relational database
- **SQLAlchemy** (async) — ORM
- **Alembic** — Schema migrations

## Design principles

- Project sections are stored as JSONB columns on the `projects` table rather than normalized child tables. This matches the section-at-a-time update pattern (`PUT /api/v1/projects/:id/sections/:key`) and avoids complex joins for what are essentially document-like structures.
- The `audit_log` table uses append-only inserts — never update or delete rows.
- Wave–project association is a foreign key on the `projects` table (`wave_id`).

## Planned schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `name` | `TEXT NOT NULL` | |
| `email` | `TEXT UNIQUE NOT NULL` | |
| `department` | `TEXT` | |
| `team` | `TEXT` | |
| `initials` | `TEXT` | |
| `role` | `TEXT` | e.g. `'Platform Migration Lead'` |
| `created_at` | `TIMESTAMPTZ` | |

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `name` | `TEXT NOT NULL` | |
| `status` | `TEXT NOT NULL` | `ProjectStatus` enum |
| `progress` | `INTEGER` | 0–100 |
| `description` | `TEXT` | |
| `migration_wave` | `TEXT` | Legacy label; display falls back to wave name |
| `profile_owner` | `TEXT` | |
| `jira_ticket` | `TEXT` | |
| `last_updated` | `TIMESTAMPTZ` | |
| `wave_id` | `UUID FK → waves.id` | nullable |
| `jira_story_key` | `TEXT` | e.g. `'MIG-200'` |
| `jira_job_status` | `TEXT` | `'pending' \| 'processing' \| 'completed' \| 'failed'` |
| `jira_subtask_config` | `JSONB` | `JiraSubtaskConfig` |
| `application_overview` | `JSONB` | `ApplicationOverview` |
| `current_infrastructure` | `JSONB` | `CurrentInfrastructure` |
| `availability` | `JSONB` | `AvailabilityResilience` |
| `data_persistence` | `JSONB` | `DataPersistence` |
| `dependencies` | `JSONB` | `Dependencies` |
| `nfrs` | `JSONB` | `NonFunctionalRequirements` |
| `migration_constraints` | `JSONB` | `MigrationConstraints` |
| `target_architecture` | `JSONB` | `TargetArchitecture` |
| `risks` | `JSONB` | `Risk[]` |
| `approvals` | `JSONB` | `Approval[]` |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

### `project_users` (association)

| Column | Type | Notes |
|---|---|---|
| `project_id` | `UUID FK → projects.id` | |
| `user_id` | `UUID FK → users.id` | |

### `waves`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `name` | `TEXT NOT NULL` | |
| `start_date` | `DATE NOT NULL` | |
| `cutover_date` | `DATE NOT NULL` | |
| `description` | `TEXT` | |
| `jira_project_key` | `TEXT NOT NULL` | e.g. `'MIG'` |
| `jira_epic_key` | `TEXT` | e.g. `'MIG-42'`; populated after creation |
| `source` | `TEXT NOT NULL` | `'created' \| 'imported'` |
| `status` | `TEXT NOT NULL` | `WaveStatus` |
| `created_at` | `TIMESTAMPTZ` | |

### `audit_log`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `project_id` | `UUID FK → projects.id` | |
| `timestamp` | `TIMESTAMPTZ NOT NULL` | |
| `actor_id` | `UUID FK → users.id` | |
| `actor_name` | `TEXT` | Denormalized for display |
| `actor_initials` | `TEXT` | Denormalized for display |
| `event_type` | `TEXT NOT NULL` | `AuditEventType` |
| `entity_type` | `TEXT NOT NULL` | `AuditEntityType` |
| `entity_id` | `TEXT` | nullable |
| `entity_label` | `TEXT` | nullable |
| `section_key` | `TEXT` | nullable |
| `section_label` | `TEXT` | nullable |
| `changes` | `JSONB NOT NULL` | `AuditChange[]` |

### `jira_jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `project_id` | `UUID FK → projects.id` | |
| `status` | `TEXT NOT NULL` | `'pending' \| 'processing' \| 'completed' \| 'failed'` |
| `config` | `JSONB NOT NULL` | `JiraSubtaskConfig` |
| `requested_at` | `TIMESTAMPTZ NOT NULL` | |
| `processed_at` | `TIMESTAMPTZ` | nullable |
| `story_key` | `TEXT` | nullable |
| `subtask_keys` | `JSONB` | `Record<string, string>` |

## Migrations

Use Alembic for all schema changes. Never modify the database schema directly.

```bash
# Generate a new migration
alembic revision --autogenerate -m "describe_the_change"

# Apply migrations
alembic upgrade head

# Downgrade one step
alembic downgrade -1
```

Migration scripts live in `backend/alembic/versions/`.
