# REST API Reference

All endpoints are prefixed with `/api/v1`. All request and response bodies are JSON. See [../shared/data-model.md](../shared/data-model.md) for full type definitions. OpenAPI docs are available at `http://localhost:8000/docs` while the backend is running.

---

## Authentication

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
1. Backend POSTs `{client_id, client_secret, code}` to `{OAUTH_SERVICE_URL}/api/v1/oauth/sso/userinfo`
2. OAuth service returns user details JSON
3. Backend looks up the user by `email` in the local database
4. Backend issues a signed JWT session token
5. Returns `{user: User, token: string}`

**Response:** `SSOExchangeResponse` — `{ user: User, token: string }`

**Errors:**
- `503` — OAuth service not configured
- `401` — Invalid/expired code, or user not found in database

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

Creates a new project.

**Request body:** `ProjectCreate` — at minimum `{ "id": "string", "name": "string" }`

**Response:** `Project`

---

### `GET /api/v1/projects/:id`

Returns a single project by ID, with all sections, cloud resources, risks, and approvals.

**Response:** `Project`

---

### `PATCH /api/v1/projects/:id`

Updates top-level project fields (status, progress, waveId, jiraTicket, etc.).

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
| `team` | JSONB column on `projects` |
| `jiraSubtaskConfig` | JSONB column on `projects` |
| `currentInfrastructure` | Delegates to `cloud_resources` table (replace-all) |
| `risks` | Delegates to `risks` table (replace-all) |
| `approvals` | Delegates to `approvals` table (replace-all) |

---

### `GET /api/v1/projects/:id/audit-log`

Returns audit log entries for a project, sorted newest-first.

**Response:**
```json
{
  "entries": "AuditLogEntry[]",
  "total": 42,
  "page": 1,
  "limit": 50
}
```

---

## Cloud Resources

### `POST /api/v1/projects/:id/resources/specs`

Batch-updates the `specs` field for multiple cloud resources. Used by the resource questionnaire to write spec data per resource.

**Request body:** `{ "updates": [{ "resourceId": "string", "specs": {} }] }`

**Response:** `{ "updated": number }`

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

Creates a Jira job and starts background processing.

**Request body:** `{ "projectId": "string", "config": "JiraSubtaskConfig" }`

**Response:** `202 Accepted` — `JiraJob` with `status: "pending"`

Processing flow: `pending` → `processing` → generates story key + per-resource subtask keys → writes back to `projects` and `cloud_resources` → `completed` (or `failed`).

> **Known gap:** `frontend/src/services/jiraJobs.ts` currently bypasses `apiClient` and calls the mock store directly. These endpoints are defined and functional but the frontend won't use them until that service is refactored.

---

### `GET /api/v1/jira/jobs/:id`

Returns a Jira job by ID.

**Response:** `JiraJob`

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
