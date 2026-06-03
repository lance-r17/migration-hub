# Database

## Technology

- **PostgreSQL 16** — Primary relational database
- **SQLAlchemy 2.0** (async, `asyncpg` driver) — ORM
- **Alembic** — Schema migrations

## Design principles

- Project sections (`application_overview`, `availability`, `data_persistence`, `dependencies`, `nfrs`, `migration_constraints`, `target_architecture`, `migration_effort_estimation`, `planning`) are stored as JSONB columns on the `projects` table. This matches the section-at-a-time update pattern (`PATCH /api/v1/projects/:id/sections/:key`) and avoids complex joins for document-like structures.
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
| `role` | `TEXT` | comma-separated roles; e.g. `'platform_migration_lead,admin'` |
| `is_service_account` | `BOOLEAN NOT NULL` | default `false` |
| `api_key_hash` | `TEXT` | nullable; SHA-256 of the issued API key |

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
| `blocked_reason` | `TEXT` | nullable |
| `description` | `TEXT` | nullable |
| `migration_wave` | `TEXT` | nullable; legacy label |
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
| `migration_effort_estimation` | `JSONB` | nullable; `MigrationEffortEstimation` |
| `planning` | `JSONB` | nullable; `ProjectPlanning` |
| `survey_submitted_at` | `TIMESTAMPTZ` | nullable |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

> **`progress` and `stage_progress` are not stored.** They are computed on every API read from section completion state (`setup`, `survey`, `signoff`, `migration`). See `project_service.compute_stage_progress()`.  
> **`team` is not stored.** It is derived from `project_users` at API serialization time.

### `project_users`

| Column | Type | Notes |
|---|---|---|
| `project_id` | `TEXT FK → projects.id` | composite PK |
| `user_id` | `TEXT FK → users.id` | composite PK |
| `role` | `TEXT` | nullable; comma-separated roles (e.g. `itso,technical_lead`) |

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

### `engagements`

One engagement per project (unique constraint on `project_id`). Stores interview scheduling metadata and Notion-block notes.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `project_id` | `TEXT FK → projects.id UNIQUE NOT NULL` | 1:1 with project |
| `status` | `TEXT` | nullable; `'pending'\|'scheduled'\|'completed'\|'cancelled'\|'no_show'` |
| `interview_subject` | `TEXT` | nullable; used as Confluence page title |
| `engagement_manager_id` | `TEXT` | nullable; FK-by-convention to `users.id` |
| `confluence_page_id` | `TEXT` | nullable; set after first Confluence export |
| `confluence_page_url` | `TEXT` | nullable; full URL of the Confluence page |
| `zoom_meeting_url` | `TEXT` | nullable; join URL created by Zoom integration |
| `zoom_meeting_id` | `TEXT` | nullable; Zoom meeting ID |
| `planned_slots` | `JSONB` | nullable; `EngagementSlot[]` — `[{id, start, end, isActual?}]` |
| `participant_ids` | `JSONB` | nullable; `string[]` of user IDs |
| `notes` | `JSONB` | nullable; Notion `Block[]` — the interview notes |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

> Migrations: `0023_add_engagement_to_projects`, `0024_extract_engagement_to_table`, `0028_add_confluence_parent_pages_and_engagement_page_id`

### `note_templates`

Reusable Notion-block templates with scope-based visibility.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | UUID |
| `name` | `TEXT NOT NULL` | |
| `description` | `TEXT` | nullable |
| `labels` | `JSONB NOT NULL` | `string[]` — e.g. `['engagement', 'architecture']` |
| `blocks` | `JSONB NOT NULL` | Notion `Block[]` |
| `scope` | `TEXT NOT NULL` | `'global'\|'private'\|'function'`; default `'private'` |
| `shared_roles` | `JSONB NOT NULL` | `string[]`; roles that can view/use when `scope='function'` |
| `created_by` | `TEXT` | nullable; user ID of the creator |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | |

> Migrations: `0025_add_note_templates`, `0026_add_shared_roles_to_note_templates`

### `note_template_versions`

Immutable snapshots of a `note_templates` row. A snapshot is created automatically before every update and before every restore. Deleted (cascade) when the parent template is deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | UUID |
| `template_id` | `TEXT FK → note_templates.id CASCADE NOT NULL` | |
| `version_number` | `INTEGER NOT NULL` | auto-incremented per template |
| `name` | `TEXT NOT NULL` | snapshot of `note_templates.name` at save time |
| `description` | `TEXT` | nullable |
| `labels` | `JSONB NOT NULL` | snapshot of `labels` |
| `blocks` | `JSONB NOT NULL` | snapshot of `blocks` |
| `scope` | `TEXT NOT NULL` | snapshot of `scope` |
| `shared_roles` | `JSONB NOT NULL` | snapshot of `shared_roles` |
| `created_by` | `TEXT` | nullable; user ID who triggered the snapshot |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |

> Migration: `0027_add_note_template_versions`

### `category_milestones`

Master-data milestones that can be assigned to multiple projects.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | |
| `start_date` | `TEXT NOT NULL` | ISO date string |
| `end_date` | `TEXT NOT NULL` | ISO date string |
| `color` | `TEXT` | nullable; hex colour for Gantt overlay |
| `icon` | `TEXT` | nullable; icon name for Gantt overlay |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |

### `project_category_milestone`

Many-to-many association between projects and category milestones.

| Column | Type | Notes |
|---|---|---|
| `project_id` | `TEXT FK → projects.id CASCADE` | composite PK |
| `category_milestone_id` | `TEXT FK → category_milestones.id CASCADE` | composite PK |

> Migration: `0030_add_category_milestones`

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

## Seeding

The `backend/scripts/seed.py` script populates the database with mock data from `backend/scripts/seed_data/*.json`.

### Usage

```bash
# Skip if already seeded (default)
python scripts/seed.py

# Clear and re-seed everything
python scripts/seed.py --force

# Refresh only specific entities
python scripts/seed.py --projects --waves
```

### Supported flags

| Flag | Description |
|---|---|
| `--force` | Clear and re-seed even if data exists |
| `--users` | Refresh users only |
| `--waves` | Refresh waves only |
| `--projects` | Refresh projects (and related resources, risks, approvals) only |
| `--embargos` | Refresh embargo records only |
| `--billing` | Refresh billing records only |
| `--config` | Refresh **all** config store entries |
| `--config-survey-config` | Refresh survey config only |
| `--config-resource-survey-config` | Refresh resource survey config only |
| `--config-billing-threshold-config` | Refresh billing threshold config only |
| `--config-migration-settings` | Refresh migration settings only |
| `--email-templates` | Refresh email templates only |

### Config seeding behavior

- `--config` always clears the entire `config_store` table before reseeding (existing behavior).
- Individual `--config-{key}` flags perform an **upsert** by default: they update the existing row if present, or insert a new one. Other config entries are left untouched.
- To force-delete before reseeding a specific config entry, combine with `--force`:
  ```bash
  python scripts/seed.py --force --config-migration-settings
  ```

### Data files

| File | Entity | Config key (if applicable) |
|---|---|---|
| `users.json` | `users` | — |
| `waves.json` | `waves` | — |
| `projects.json` | `projects`, `cloud_resources`, `risks`, `approvals`, `project_users` | — |
| `embargos.json` | `embargo_records` | — |
| `billing.json` | `billing_records` | — |
| `survey_config.json` | `config_store` | `survey_config` |
| `resource_survey_config.json` | `config_store` | `resource_survey_config` |
| `billing_config.json` | `config_store` | `billing_threshold_config` |
| `migration_settings.json` | `config_store` | `migration_settings` |
| `email_templates.json` | `email_templates` | — |

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

Migration scripts live in `backend/alembic/versions/`. The initial schema (`0001_initial_schema.py`) is hand-authored and creates the core tables in FK dependency order.
