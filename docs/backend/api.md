# REST API Reference

This document lists all endpoints that the frontend service layer calls. It serves as the contract the backend must implement.

All endpoints are prefixed with `/api/v1`. All request and response bodies are JSON. See [../shared/data-model.md](../shared/data-model.md) for full type definitions.

---

## Authentication

### `POST /api/v1/auth/login`

Authenticates a user.

**Request body:**
```json
{ "email": "string", "password": "string" }
```

**Response:** `User`

---

## Users

### `GET /api/v1/users`

Returns all users. Used to populate people-picker dropdowns.

**Response:** `User[]`

---

### `GET /api/v1/users/me`

Returns the currently authenticated user (session/token-based).

**Response:** `User`

---

### `GET /api/v1/projects/:id/users`

Returns users associated with a specific project (team members).

**Response:** `User[]`

---

## Projects

### `GET /api/v1/projects`

Returns all projects visible to the authenticated user. Platform team sees all; project members see only their own.

**Response:** `Project[]`

---

### `GET /api/v1/projects/:id`

Returns a single project by ID.

**Response:** `Project`

---

### `PUT /api/v1/projects/:id/sections/:key`

Updates one section key on a project. The `:key` segment is a `keyof Project` (e.g. `applicationOverview`, `risks`, `approvals`, `waveId`).

**Request body:** The new value for the section (type depends on `:key`)

**Response:** The full updated `Project`

**Side effects (backend must implement):**
- Append an `AuditLogEntry` row in the same transaction
- If `:key` is `approvals` and all approvals are now `approved`, auto-transition `Project.status` to `'signed-off'`
- If `:key` is `jiraSubtaskConfig`, enqueue a background Jira job

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

Creates a new wave and the corresponding Jira epic.

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

**Response:** `Wave` with `jiraEpicKey` and `jiraProjectKey` populated

---

### `POST /api/v1/waves/import`

Imports an existing Jira epic as a migration wave. Fetches epic metadata from Jira.

**Request body:**
```json
{ "epicKey": "MIG-42" }
```

**Response:** `Wave` with `source: "imported"` and `jiraEpicKey` populated

---

## Dashboard

### `GET /api/v1/dashboard/stats`

Returns aggregate migration statistics.

**Response:** `OverallStats`

---

### `GET /api/v1/dashboard/activity`

Returns recent activity entries.

**Response:** `Activity[]`

---

## Audit log

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

> Note: The frontend service unwraps `entries` from the paginated envelope. The array returned to hooks is `AuditLogEntry[]`.

---

## Email templates

### `GET /api/v1/email-templates`

Returns all email templates.

**Response:** `EmailTemplate[]`

---

### `GET /api/v1/email-templates/:id`

Returns a single email template.

**Response:** `EmailTemplate`

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

Sends a rendered test email to a recipient address. The frontend pre-renders the template HTML and passes it as `htmlContent`.

> **Note:** In local development without the FastAPI backend, this endpoint is handled by the `email-server/` Node.js relay service instead. When the FastAPI backend is implemented, it must match this same contract.

**Request body:**
```json
{
  "recipientEmail": "you@example.com",
  "subject": "Wave 3 — Migration Ready",
  "htmlContent": "<html>...</html>"
}
```

**Response:** `{ "ok": true }`

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
| `500` | Internal server error |
