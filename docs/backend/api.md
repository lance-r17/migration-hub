# REST API Reference

All endpoints are prefixed with `/api/v1`. All request and response bodies are JSON. See [../shared/data-model.md](../shared/data-model.md) for full type definitions. OpenAPI docs are available at `http://localhost:8000/docs` while the backend is running.

---

## Authentication

All mutating endpoints require authentication. Three mechanisms are supported (checked in priority order):

| Mechanism | Header | When to use |
|---|---|---|
| **API Key** | `X-API-Key: mhub_<key>` | Service accounts / automated integrations |
| **Bearer JWT** | `Authorization: Bearer <token>` | Custom OAuth or standard OIDC (human users) |
| **Mock** | _(none)_ | Dev only — returns `CURRENT_USER_ID` user when no auth is configured |

Service accounts are created via `POST /admin/service-accounts` (admin only). The plaintext key is returned once on creation and never stored.

---

### `POST /api/v1/auth/login`

Legacy mock login. Authenticates a user by email.

**Request body:**
```json
{ "email": "string", "password": "string" }
```

**Response:** `User`

> No password validation — any credentials for a known email return the matching user. Used only in mock auth mode.

---

### `POST /api/v1/auth/sso/exchange`

Custom OAuth code exchange. The frontend calls this after receiving a one-time `code` from the OAuth service callback.

**Request body:**
```json
{ "code": "string" }
```

**Flow:**
1. Backend GETs `{OAUTH_SERVICE_URL}/api/v1/oauth/sso/userinfo` with `client_id`, `client_secret`, and `code` query parameters
2. OAuth service returns user details JSON (including `member_of` AD groups)
3. Backend derives the user's global role from `OAUTH_ROLE_MAPPINGS` against AD groups
4. Backend derives project memberships from `OAUTH_AD_GROUP_MAPPINGS` (or falls back to `OAUTH_AD_GROUP_REGEX`) against AD groups
5. Backend looks up the user by `email`; if not found, **auto-provisions** a new user from the OAuth data
6. Backend syncs `project_users` rows with `role='member'` for matched projects (governance roles and ITSO are never touched)
7. Backend issues a signed JWT session token
8. Returns `{user: User, token: string}`

**Response:** `SSOExchangeResponse` — `{ user: User, token: string }`

**Side effects:**
- `users.role` is overwritten from AD group mappings
- `project_users` member token is added/removed based on AD group matches
- Governance roles and ITSO are preserved (non-member roles are never touched)

**Errors:**
- `503` — OAuth service not configured
- `401` — Invalid/expired code, or user not found in database (OIDC mode only; Custom OAuth auto-provisions)

---

### `GET /api/v1/auth/sso/login-url`

Returns the fully-formed OAuth service authentication URL. Useful for the frontend to avoid hard-coding endpoint paths.

**Query params:**
- `redirect_uri` — callback URL (default: `http://localhost:5173/callback`)

**Response:** `{ url: string }`

---

## Users

### `GET /api/v1/users`

Returns all users. Used to populate people-picker dropdowns.

**Response:** `User[]`

---

### `GET /api/v1/users/me`

Returns the currently authenticated user. Resolution depends on the active auth mode:

- **Custom OAuth** — verifies `Authorization: Bearer <backend_jwt>` (HS256), extracts `email` claim, looks up user
- **Standard OIDC** — verifies `Authorization: Bearer <idp_jwt>` (RS256 via JWKS), extracts `email` claim, looks up user
- **Mock auth** — returns the user matching `CURRENT_USER_ID`

**Response:** `User`

---

## Projects

### `GET /api/v1/projects`

Returns all projects visible to the authenticated user.

**Response:** `Project[]`

---

### `POST /api/v1/projects`

Creates a new project. Requires authentication — records the creator as the audit actor.

**Request body:** `ProjectCreate` — at minimum `{ "name": "string" }`; `id` is auto-generated if omitted.

**Response:** `Project`

**Audit:** emits `project_created` event.

---

### `GET /api/v1/projects/:id`

Returns a single project by ID, with all sections, cloud resources, risks, and approvals.

**Response:** `Project`

---

### `PATCH /api/v1/projects/:id`

Updates top-level project fields (status, progress, waveId, etc.).

**Request body:** partial `Project` (only included fields are updated)

**Response:** `Project`

---

### `PATCH /api/v1/projects/:id/sections/:key`

Replaces one section on a project. `:key` is a camelCase section name (e.g. `applicationOverview`, `risks`, `approvals`, `currentInfrastructure`).

**Request body:** `{ "value": <section payload> }`

**Response:** `Project`

**Side effects:**
- Appends an `AuditLogEntry` row in the same transaction
- If `:key` is `approvals` and all approvals are now `approved`, auto-transitions `Project.status` to `'signed-off'`
- If `:key` is `jiraSubtaskConfig`, enqueues a background Jira job

**Section key routing:**

| `:key` | Storage |
|---|---|
| `applicationOverview` | JSONB column on `projects` |
| `availability` | JSONB column on `projects` |
| `dataPersistence` | JSONB column on `projects` |
| `dependencies` | JSONB column on `projects` |
| `nfrs` | JSONB column on `projects` |
| `migrationConstraints` | JSONB column on `projects` |
| `targetArchitecture` | JSONB column on `projects` |
| `jiraSubtaskConfig` | JSONB column on `projects` |
| `status` | Scalar column on `projects` |
| `waveId` | Scalar column on `projects` |
| `currentInfrastructure` | Delegates to `cloud_resources` table (replace-all) |
| `risks` | Delegates to `risks` table (replace-all) |
| `approvals` | Delegates to `approvals` table (replace-all) |

---

### `GET /api/v1/projects/:id/users`

Returns users who are members of a project.

**Response:** `User[]`

---

### `PUT /api/v1/projects/:id/project-user-roles`

Upsert project user roles for a single project. Each item in the payload replaces the roles for the specified user. An empty `roles` array deletes the project_users row. Users not in the payload are untouched.

**Request body:**
```json
[
  { "user_id": "u1", "roles": ["itso"] },
  { "user_id": "u2", "roles": ["technical_lead", "itso"] }
]
```

**Response:** `Project`

**Authorization:** Service account only (`X-API-Key`).

---

### `POST /api/v1/projects/:id/survey-submitted`

Marks the project's survey as submitted (sets `surveySubmittedAt` timestamp). Advances stage progress from `survey: 0` to `survey: 100`.

**Response:** `Project`

**Audit:** emits `survey_submitted` event.

---

### `POST /api/v1/projects/:id/reset`

Resets a project's record to its initial state while preserving application overview, team assignments, cloud resources, and attachments.

**Authorization:** Requires `platform_migration_lead` role.

**Cleared fields:**
- `status` → `"planning"`
- `blocked_reason` → `null`
- `survey_submitted_at` → `null`
- `planning` → `null`
- `availability`, `data_persistence`, `dependencies`, `nfrs`, `migration_constraints`, `target_architecture`, `migration_effort_estimation`, `jira_subtask_config` → `null`
- `jira_story_key` → `null`
- `jira_job_status` → `null`
- All `risks` → deleted
- All `approvals` → deleted
- All prior `audit_log_entries` → deleted

**Preserved:** `name`, `description`, `application_overview`, `project_users`, `cloud_resources`, `attachments`, `wave_id`, `migration_wave`.

**Response:** `Project`

**Audit:** the project's entire audit history is wiped, then a single `project_reset` event is recorded with a summary of all cleared fields.

---

### `PATCH /api/v1/projects/:id/planning`

Replaces the project's planning JSONB (start date, end date, task list). Requires authentication.

**Request body:**
```json
{
  "planning": {
    "startDate": "2026-05-01",
    "endDate": "2026-08-31",
    "tasks": []
  }
}
```

**Response:** `Project`

**Side effects:** if a Jira story key exists, best-effort syncs `startDate`/`endDate` to Jira target date custom fields in the background.

**Audit:** emits `section_updated` with `sectionKey: "planning"`.

---

### `GET /api/v1/projects/:id/audit-log`

Returns audit log entries for a project, sorted newest-first.

**Response:**
```json
{
  "entries": "AuditLogEntry[]",
  "total": 42
}
```

**Audit event types:**

| `eventType` | Trigger |
|---|---|
| `project_created` | `POST /projects` |
| `section_updated` | `PATCH /sections/{key}` or `PATCH /planning` |
| `status_changed` | `PATCH /projects/:id` with `status` field |
| `risks_updated` | `PATCH /sections/risks` |
| `approval_submitted` | `PATCH /sections/approvals` |
| `survey_submitted` | `POST /survey-submitted` |
| `resource_added` | `PATCH /sections/currentInfrastructure` — new resource |
| `resource_removed` | `PATCH /sections/currentInfrastructure` — resource deleted |
| `resource_updated` | `PATCH /sections/currentInfrastructure` — field change |
| `resource_sync_completed` | `POST /resources/:id/sync-complete` |

Each entry's `actor` object is `{ id, name, initials }` for human users; service account entries additionally include `"type": "service_account"`.

---

## Cloud Resources

### `PATCH /api/v1/projects/:id/resources`

Upserts specific resources **without** affecting the rest of the project's resource list.

- Items with `resource_id` **already in DB** → update only the non-null fields provided; other fields on that resource are unchanged
- Items with `resource_id` **not in DB** → create a new resource
- Resources **absent** from the payload → left untouched

This is the targeted alternative to `PATCH /sections/currentInfrastructure`, which is a full replace.

**Request body:**
```json
{
  "resources": [
    {
      "resource_id": "rm-bp1abc123456",
      "sync_status": "synced",
      "target_resource_id": "rm-cn-hz-target-001"
    },
    {
      "resource_id": "rm-new-999",
      "name": "prod-redis-cache",
      "product": "r-kvstore",
      "resource_set": "set-cache",
      "need_migration": true
    }
  ]
}
```

All fields use **snake_case** (consistent with other typed schemas). `resource_id` is the cloud provider resource identifier and serves as the primary key.

**Response:** `Project`

**Audit:** emits `resource_updated` per changed resource; `resource_added` per created resource.

---

### `DELETE /api/v1/projects/:id/resources`

Deletes specific resources by `resource_id`. IDs not found in the project are silently skipped — no error is returned for unknown IDs.

**Request body:**
```json
{ "resource_ids": ["rm-bp1abc123456", "oss-bucket-prod-assets"] }
```

**Response:** `Project` — updated resource list, so the caller sees the result without a separate fetch.

**Audit:** emits `resource_removed` per deleted resource.

---

### `POST /api/v1/projects/:id/resources/specs`

Batch-updates the `specs` JSONB field for multiple cloud resources. Merges provided specs into existing — does not replace the full resource.

**Request body:** `{ "updates": [{ "resource_id": "string", "specs": {} }] }`

> Note: `resource_id` is the cloud provider resource identifier.

**Response:** `204 No Content`

**Audit:** emits `resource_updated` per changed resource.

---

### `POST /api/v1/projects/:id/resources/:resource_id/sync-complete`

Marks a single cloud resource's migration sync as complete (`syncStatus → "synced"`, `migrationCompleted → true`). If the resource has an associated Jira subtask, queues a background job to close it.

**Response:** `202 Accepted` — `Project`

**Audit:** emits `resource_sync_completed`.

---

## Admin — Service Accounts

All endpoints in this section require the `platform_migration_lead` or `admin` role.

### `POST /api/v1/admin/service-accounts`

Creates a new service account user and issues an API key. The plaintext key is returned **once** and never stored — save it immediately.

**Request body:**
```json
{
  "name": "Inventory Sync Bot",
  "email": "svc-inventory@example.com",
  "department": "Platform"
}
```

**Response:**
```json
{
  "id": "svc-a1b2c3d4",
  "name": "Inventory Sync Bot",
  "email": "svc-inventory@example.com",
  "department": "Platform",
  "initials": "IS",
  "api_key": "mhub_<64-hex>"
}
```

Use the returned `api_key` as the `X-API-Key` header on all subsequent requests.

---

### `GET /api/v1/admin/service-accounts`

Lists all service accounts.

**Response:** `ServiceAccountOut[]` — same shape as above minus `api_key`.

---

### `DELETE /api/v1/admin/service-accounts/:id`

Revokes a service account's API key by clearing its hash. The user row is retained for audit log attribution. After revocation, any request using the old key returns `401`.

**Response:** `204 No Content`

---

### `POST /api/v1/admin/users/batch`

Batch create human users. Existing users matched by `email` are skipped, but their full records (including `id`) are still returned so callers can use them for downstream governance assignment.

**Request body:**
```json
{
  "users": [
    {
      "id": "optional-custom-id",
      "name": "Alice Lead",
      "email": "alice.lead@example.com",
      "department": "Engineering",
      "team": "Platform",
      "initials": "AL",
      "role": "technical_lead"
    }
  ]
}
```

**Response:**
```json
{
  "created": 1,
  "skipped": 0,
  "users": [
    {
      "id": "usr-a1b2c3d4",
      "name": "Alice Lead",
      "email": "alice.lead@example.com",
      "department": "Engineering",
      "team": "Platform",
      "initials": "AL",
      "role": "technical_lead"
    }
  ]
}
```

**Authorization:** Admin role required (`require_admin`).

**Idempotency:** Re-running the same payload increments `skipped` instead of failing.

---

## Waves

### `GET /api/v1/waves`

Returns all migration waves.

**Response:** `Wave[]`

---

### `GET /api/v1/waves/:id`

Returns a single wave by ID.

**Response:** `Wave`

---

### `POST /api/v1/waves`

Creates a new wave.

**Request body:**
```json
{
  "name": "string",
  "startDate": "2026-04-01",
  "cutoverDate": "2026-06-30",
  "description": "string (optional)",
  "source": "created",
  "status": "planned"
}
```

**Response:** `Wave`

---

### `PATCH /api/v1/waves/:id`

Updates wave fields.

**Request body:** partial `Wave`

**Response:** `Wave`

---

### `POST /api/v1/waves/import`

Imports an existing Jira epic as a migration wave.

**Request body:**
```json
{ "epicKey": "MIG-42" }
```

**Response:** `Wave` with `source: "imported"` and `jiraEpicKey` populated

---

## Dashboard

### `GET /api/v1/dashboard/stats`

Returns aggregate migration statistics across all projects.

**Response:** `OverallStats`

---

### `GET /api/v1/dashboard/activity`

Returns recent audit activity.

**Response:** `Activity[]`

---

## Embargos

### `GET /api/v1/embargos`

Returns all embargo records.

**Response:** `EmbargoRecord[]`

---

### `POST /api/v1/embargos`

Creates a new embargo record.

**Request body:** `EmbargoCreate`

**Response:** `EmbargoRecord`

---

### `PUT /api/v1/embargos/:id`

Replaces an embargo record.

**Request body:** `EmbargoRecord`

**Response:** `EmbargoRecord`

---

### `DELETE /api/v1/embargos/:id`

Deletes an embargo record.

**Response:** `204 No Content`

---

## Billing

### `GET /api/v1/billing/months?env=existing|target`

Returns the list of months that have billing data for the given environment.

**Response:** `string[]` — e.g. `["2026-01", "2026-02"]`

---

### `GET /api/v1/billing?month=2026-01&env=existing`

Returns billing records for a specific month and environment.

**Response:** `BillingRecord[]`

---

### `POST /api/v1/billing`

Upserts billing records for a month+environment pair. Replaces all existing records for that pair in a single transaction.

**Request body:**
```json
{
  "month": "2026-01",
  "env": "existing",
  "records": "BillingRecord[]"
}
```

**Response:** `{ "inserted": number }`

---

## Survey / Settings

### `GET /api/v1/settings/survey`

Returns the current survey configuration.

**Response:** `SurveyConfig`

---

### `PUT /api/v1/settings/survey`

Replaces the survey configuration.

**Request body:** `SurveyConfig`

**Response:** `SurveyConfig`

---

### `GET /api/v1/settings/survey/field-defs`

Returns the static field definitions used to render the survey form. These only change with releases — no database backing.

**Response:** `SurveyFieldDef[]`

---

### `GET /api/v1/settings/resource-survey`

Returns the resource survey configuration.

**Response:** `ResourceSurveyConfig`

---

### `PUT /api/v1/settings/resource-survey`

Replaces the resource survey configuration.

**Request body:** `ResourceSurveyConfig`

**Response:** `ResourceSurveyConfig`

---

## Billing Config

### `GET /api/v1/settings/billing-thresholds`

Returns the billing threshold configuration.

**Response:** `BillingThresholdConfig`

---

### `PUT /api/v1/settings/billing-thresholds`

Replaces the billing threshold configuration.

**Request body:** `BillingThresholdConfig`

**Response:** `BillingThresholdConfig`

---

## Product Categories

### `GET /api/v1/product-category-map`

Returns the static product → category mapping used to group cloud resources.

**Response:** `Record<string, string>`

---

## Email Templates

### `GET /api/v1/email-templates`

Returns all email templates.

**Response:** `EmailTemplate[]`

---

### `POST /api/v1/email-templates`

Creates a new blank email template with default style and empty layout.

**Response:** `EmailTemplate` with generated `id` and defaults populated

---

### `PUT /api/v1/email-templates/:id`

Replaces the full email template.

**Request body:** `EmailTemplate`

**Response:** `EmailTemplate`

---

### `DELETE /api/v1/email-templates/:id`

Deletes an email template.

**Response:** `204 No Content`

---

### `POST /api/v1/email-templates/send-test`

Sends a rendered test email to a recipient address.

**Request body:**
```json
{
  "recipientEmail": "you@example.com",
  "subject": "Wave 3 — Migration Ready",
  "htmlContent": "<html>...</html>"
}
```

**Response:** `{ "ok": true }`

> In local development without the FastAPI backend running, the `email-server/` Node.js relay handles this same contract.

---

## Jira Jobs

### `POST /api/v1/jira/jobs`

Creates a Jira story job and starts background processing.

**Request body:** `{ "project_id": "string", "config": "JiraSubtaskConfig", "wave_epic_key": "string" }`

**Response:** `202 Accepted` — `JiraJob` with `status: "pending"`

Processing flow: `pending` → `processing` → generates story key + per-resource subtask keys → writes back to `projects` and `cloud_resources` → `completed` (or `failed`).

---

### `GET /api/v1/jira/jobs/:id`

Returns a Jira job by ID.

**Response:** `JiraJob`

---

### `GET /api/v1/jira/jobs/:id/logs`

Returns processing logs for a Jira job.

**Response:** `JiraJobLog[]`

---

### `POST /api/v1/jira/projects/:id/retry-job`

Retries a failed Jira job for a project.

**Response:** `JiraJob`

---

### `POST /api/v1/jira/projects/:id/operation-jobs`

Creates a change-request (operation) job for selected sub-tasks.

**Request body:** `{ "selected_subtask_keys": ["string"], "summary": "string" }`

**Response:** `OperationJobOut`

---

### `GET /api/v1/jira/projects/:id/operation-jobs`

Returns all change-request jobs for a project.

**Response:** `OperationJobOut[]`

---

### `GET /api/v1/admin/jira-jobs`

Admin endpoint: returns all Jira jobs across projects, including logs.

**Response:** `AdminJiraJobRow[]`

---

## Error responses

All error responses follow the FastAPI default format:

```json
{ "detail": "Error message" }
```

| Status | Meaning |
|---|---|
| `400` | Bad request (validation error) |
| `401` | Unauthenticated |
| `403` | Forbidden (insufficient role/access) |
| `404` | Resource not found |
| `422` | Unprocessable entity (Pydantic validation failure) |
| `500` | Internal server error |
