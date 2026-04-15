# Database

## Technology

- **PostgreSQL 16** — Primary relational database
- **SQLAlchemy 2.0** (async, `asyncpg` driver) — ORM
- **Alembic** — Schema migrations

## Design principles

- Project sections (`application_overview`, `availability`, `data_persistence`, `dependencies`, `nfrs`, `migration_constraints`, `target_architecture`, `team`) are stored as JSONB columns on the `projects` table. This matches the section-at-a-time update pattern (`PATCH /api/v1/projects/:id/sections/:key`) and avoids complex joins for document-like structures.
- `cloud_resources`, `risks`, and `approvals` are **separate normalized tables** with FK to `projects`. Each can be queried, created, and updated individually.
- The `audit_log_entries` table uses append-only inserts — never update or delete rows.
- Wave–project association is a FK on the `projects` table (`wave_id`).
- Project IDs are `TEXT` (not UUID) to preserve frontend IDs like `PRJ-2024-ALPHA` and `M-11029`.
- The `config_store` table is a singleton key→JSONB store for survey config, resource survey config, and billing thresholds.
- VARCHAR/TEXT strings for enum columns (avoids Alembic migration pain when adding new enum values).

## Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | e.g. `u1`, `u-current` |
| `name` | `TEXT NOT NULL` | |
| `email` | `TEXT UNIQUE NOT NULL` | |
| `department` | `TEXT NOT NULL` | |
| `team` | `TEXT` | nullable |
| `initials` | `TEXT NOT NULL` | |
| `role` | `TEXT` | e.g. `'Platform Migration Lead'` |

### `waves`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | |
| `start_date` | `TEXT NOT NULL` | ISO date string |
| `cutover_date` | `TEXT NOT NULL` | ISO date string |
| `description` | `TEXT` | nullable |
| `jira_project_key` | `TEXT NOT NULL` | e.g. `'MIG'` |
| `jira_epic_key` | `TEXT` | nullable; populated after creation |
| `source` | `TEXT NOT NULL` | `'created'` or `'imported'` |
| `status` | `TEXT NOT NULL` | `WaveStatus` |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | preserves frontend IDs (`PRJ-2024-ALPHA`, `M-11029`) |
| `name` | `TEXT NOT NULL` | |
| `status` | `TEXT NOT NULL` | `'planning'\|'in-progress'\|'migrating'\|'blocked'\|'signed-off'\|'completed'` |
| `progress` | `INTEGER NOT NULL` | 0–100 |
| `description` | `TEXT` | nullable |
| `migration_wave` | `TEXT` | nullable; legacy label |
| `profile_owner` | `TEXT` | nullable |
| `jira_ticket` | `TEXT` | nullable |
| `jira_base_url` | `TEXT` | nullable |
| `last_updated` | `TEXT` | nullable |
| `wave_id` | `TEXT FK → waves.id` | nullable |
| `jira_story_key` | `TEXT` | nullable; e.g. `'MIG-200'` |
| `jira_job_status` | `TEXT` | nullable; `'pending'\|'processing'\|'completed'\|'failed'` |
| `jira_subtask_config` | `JSONB` | nullable; `JiraSubtaskConfig` |
| `application_overview` | `JSONB` | nullable; `ApplicationOverview` |
| `availability` | `JSONB` | nullable; `AvailabilityResilience` |
| `data_persistence` | `JSONB` | nullable; `DataPersistence` |
| `dependencies` | `JSONB` | nullable; `Dependencies` |
| `nfrs` | `JSONB` | nullable; `NonFunctionalRequirements` |
| `migration_constraints` | `JSONB` | nullable; `MigrationConstraints` |
| `target_architecture` | `JSONB` | nullable; `TargetArchitecture` |
| `team` | `JSONB NOT NULL` | `TeamMember[]`; display cache (source of truth: `project_users`) |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

### `project_users`

| Column | Type | Notes |
|---|---|---|
| `project_id` | `TEXT FK → projects.id` | composite PK |
| `user_id` | `TEXT FK → users.id` | composite PK |
| `role` | `TEXT` | nullable |

### `cloud_resources`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | matches frontend resource IDs |
| `project_id` | `TEXT FK → projects.id NOT NULL` | indexed |
| `resource_id` | `TEXT` | nullable; external cloud resource identifier |
| `name` | `TEXT NOT NULL` | |
| `product` | `TEXT` | nullable; `'ecs'\|'rds'\|'polarDB'\|'redis'\|'oss'\|'slb'\|'dns'\|'sls'` |
| `resource_set` | `TEXT` | nullable |
| `specs` | `JSONB` | nullable; schema varies by product |
| `sub_application` | `TEXT` | nullable |
| `target_resource_id` | `TEXT` | nullable |
| `sync_status` | `TEXT NOT NULL` | `'synced'\|'out-of-sync'\|'provisioning'` |
| `need_migration` | `BOOLEAN NOT NULL` | default `true` |
| `jira_subtask_key` | `TEXT` | nullable; populated by Jira job |

### `risks`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `project_id` | `TEXT FK → projects.id NOT NULL` | |
| `title` | `TEXT NOT NULL` | |
| `description` | `TEXT NOT NULL` | |
| `severity` | `TEXT NOT NULL` | `'low'\|'medium'\|'high'\|'critical'` |
| `mitigation` | `TEXT` | nullable |
| `owner` | `TEXT` | nullable |
| `risk_status` | `TEXT` | nullable |

### `approvals`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `project_id` | `TEXT FK → projects.id NOT NULL` | |
| `role` | `TEXT NOT NULL` | e.g. `'Technical Lead'` |
| `approver` | `TEXT` | nullable; display name |
| `status` | `TEXT NOT NULL` | `'pending'\|'approved'\|'rejected'` |
| `timestamp` | `TEXT` | nullable; ISO string |
| `icon` | `TEXT NOT NULL` | |
| `user_id` | `TEXT` | nullable |

### `audit_log_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `project_id` | `TEXT FK → projects.id NOT NULL` | indexed |
| `timestamp` | `TIMESTAMPTZ NOT NULL` | |
| `actor` | `JSONB NOT NULL` | point-in-time snapshot `{ id, name, initials, role }` |
| `event_type` | `TEXT NOT NULL` | `AuditEventType` |
| `entity_type` | `TEXT NOT NULL` | `AuditEntityType` |
| `entity_id` | `TEXT` | nullable |
| `entity_label` | `TEXT` | nullable |
| `section_key` | `TEXT` | nullable |
| `section_label` | `TEXT` | nullable |
| `changes` | `JSONB NOT NULL` | `AuditChange[]` — `[{ field, oldValue, newValue }]` |

### `embargo_records`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | |
| `start_date` | `TEXT NOT NULL` | ISO date string |
| `end_date` | `TEXT NOT NULL` | ISO date string |
| `affected_service_lines` | `JSONB NOT NULL` | `string[]` |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |

### `billing_records`

| Column | Type | Notes |
|---|---|---|
| `month` | `VARCHAR(7) PK` | e.g. `'2026-01'` — composite PK |
| `env` | `TEXT PK` | `'existing'` or `'target'` — composite PK |
| `resource_set` | `TEXT PK` | resource category label — composite PK |
| `amount` | `NUMERIC(14,2) NOT NULL` | |

### `jira_jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `project_id` | `TEXT FK → projects.id NOT NULL` | indexed |
| `status` | `TEXT NOT NULL` | `'pending'\|'processing'\|'completed'\|'failed'` |
| `config` | `JSONB NOT NULL` | `JiraSubtaskConfig` |
| `requested_at` | `TIMESTAMPTZ NOT NULL` | |
| `processed_at` | `TIMESTAMPTZ` | nullable |
| `story_key` | `TEXT` | nullable |
| `subtask_keys` | `JSONB NOT NULL` | `Record<resourceId, jiraKey>` |

### `config_store`

| Column | Type | Notes |
|---|---|---|
| `key` | `TEXT PK` | `'survey_config'` \| `'resource_survey_config'` \| `'billing_threshold_config'` |
| `value` | `JSONB NOT NULL` | full config object |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

### `email_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | |
| `description` | `TEXT` | nullable |
| `event_type` | `TEXT NOT NULL` | e.g. `'wave-assigned'` |
| `subject` | `TEXT NOT NULL` | |
| `recipient_list` | `JSONB NOT NULL` | `string[]` |
| `template_style` | `JSONB NOT NULL` | `TemplateStyle` |
| `rows` | `JSONB NOT NULL` | `TemplateRow[]` |
| `is_predefined` | `BOOLEAN NOT NULL` | |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

## Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `ix_cloud_resources_project_id` | `cloud_resources` | `project_id` | load resources per project |
| `ix_audit_log_entries_project_id` | `audit_log_entries` | `project_id` | fetch audit log per project |
| `ix_billing_records_month_env` | `billing_records` | `month, env` | billing query filter |
| `ix_jira_jobs_project_id` | `jira_jobs` | `project_id` | job lookup per project |

## Migrations

All schema changes go through Alembic. Never modify the database schema directly.

```bash
# Apply all migrations
alembic upgrade head

# Generate a new migration (after model changes)
alembic revision --autogenerate -m "describe_the_change"

# Downgrade one step
alembic downgrade -1
```

Migration scripts live in `backend/alembic/versions/`. The initial schema (`0001_initial_schema.py`) is hand-authored and creates all 13 tables in FK dependency order.
