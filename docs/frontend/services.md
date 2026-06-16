# Service Layer

All service files live in `frontend/src/services/`. Each file owns one domain and exposes plain async functions. They are the only code that calls the HTTP client or the mock store — hooks and components never reach past them.

## API client (`services/client.ts`)

```ts
import { BASE_URL, USE_MOCK, delay, apiClient } from '@/services/client'
```

| Export | Type | Description |
|---|---|---|
| `BASE_URL` | `string` | Value of `VITE_API_BASE_URL` (empty string if not set) |
| `USE_MOCK` | `boolean` | `true` when `BASE_URL` is empty |
| `delay(ms?)` | `() => Promise<void>` | Simulates network latency in mock mode (default 200 ms) |
| `apiClient.get<T>(path)` | `Promise<T>` | HTTP GET |
| `apiClient.put<T>(path, body)` | `Promise<T>` | HTTP PUT |
| `apiClient.post<T>(path, body)` | `Promise<T>` | HTTP POST |

All `apiClient` methods throw an `Error` if the response status is not `2xx`.

**Auth header injection:** `authHeader()` checks `sessionStorage` for a backend-issued JWT (custom OAuth mode) first, then falls back to the OIDC `access_token` from `oidc-client-ts` (legacy OIDC mode). Mock auth sends no header.

---

## Projects (`services/projects.ts`)

```ts
import { getProjects, getProject, updateProject } from '@/services/projects'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getProjects` | `() => Promise<Project[]>` | `GET /api/v1/projects` | Returns all projects |
| `getProject` | `(id: string) => Promise<Project \| undefined>` | `GET /api/v1/projects/:id` | Returns a single project |
| `updateProject` | `<K extends keyof Project>(id, key, value) => Promise<Project>` | `PATCH /api/v1/projects/:id/sections/:key` | Updates one section key on a project; returns the full updated project |
| `submitSurvey` | `(id: string) => Promise<Project>` | `POST /api/v1/projects/:id/survey-submitted` | Marks the application survey as submitted |
| `markDataMigrationSurveySubmitted` | `(id: string) => Promise<Project>` | `POST /api/v1/projects/:id/data-migration-survey-submitted` | Marks the data migration survey as submitted |
| `getDataMigrationCycleBlocks` | `(start, end, duration) => Promise<DataMigrationCycleBlock[]>` | `GET /api/v1/projects/data-migration-cycle-blocks` | Returns booked cycle blocks for the data migration calendar |

`updateProject` is generic — the key and value are type-safe against `keyof Project`.

---

## Waves (`services/waves.ts`)

```ts
import { getWaves, getWave, createWave, importWave } from '@/services/waves'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getWaves` | `() => Promise<Wave[]>` | `GET /api/v1/waves` | Returns all waves |
| `getWave` | `(id: string) => Promise<Wave \| undefined>` | `GET /api/v1/waves/:id` | Returns a single wave |
| `createWave` | `(data: Omit<Wave, 'id' \| 'createdAt' \| 'jiraEpicKey' \| 'jiraProjectKey'>) => Promise<Wave>` | `POST /api/v1/waves` | Creates a wave + Jira epic; returns the wave with populated `jiraEpicKey` |
| `importWave` | `(epicKey: string) => Promise<Wave>` | `POST /api/v1/waves/import` | Imports an existing Jira epic as a wave |

Mock delays: `createWave` uses 600 ms; `importWave` uses 800 ms to simulate Jira API latency.

---

## Users (`services/users.ts`)

```ts
import { getUsers, getCurrentUser, getProjectUsers, login } from '@/services/users'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getUsers` | `() => Promise<User[]>` | `GET /api/v1/users` | Returns all users (for people-pickers) |
| `getCurrentUser` | `() => Promise<User>` | `GET /api/v1/users/me` | Returns the authenticated user |
| `getProjectUsers` | `(projectId: string) => Promise<User[]>` | `GET /api/v1/projects/:id/users` | Returns users associated with a project |
| `login` | `(email: string, password: string) => Promise<User>` | `POST /api/v1/auth/login` | Legacy mock login — returns the user matching `CURRENT_USER_ID` |

In mock mode, `login` always returns the same mock current user regardless of credentials.

---

## OAuth (`services/oauth.ts`)

```ts
import { exchangeCodeForSession } from '@/services/oauth'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `exchangeCodeForSession` | `(code: string) => Promise<SSOExchangeResponse>` | `POST /api/v1/auth/sso/exchange` | Exchanges a one-time OAuth code for a user + backend JWT |

`SSOExchangeResponse` shape:
```ts
{ user: User, token: string }
```

Called by `CallbackPage` after the OAuth service redirects back with `?code=...&state=...`.

---

## Audit log (`services/auditLog.ts`)

```ts
import { getAuditLog, appendAuditEntryMock } from '@/services/auditLog'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getAuditLog` | `(projectId: string) => Promise<AuditLogEntry[]>` | `GET /api/v1/projects/:id/audit-log` | Returns audit entries sorted newest-first |
| `appendAuditEntryMock` | `(entry: AuditLogEntry) => void` | — | Mock-only: appends an entry to the in-memory store |

`appendAuditEntryMock` is called by `useProject.saveSection()` after each successful save. In production, the backend writes audit rows as a transaction side-effect — this function is never called against a real API.

The real API response shape is `{ entries: AuditLogEntry[] }` (paginated envelope); the service unwraps it to return just the array.

---

## Dashboard (`services/dashboard.ts`)

```ts
import { getOverallStats, getRecentActivity } from '@/services/dashboard'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getOverallStats` | `() => Promise<OverallStats>` | `GET /api/v1/dashboard/stats` | Returns aggregate migration statistics |
| `getRecentActivity` | `() => Promise<Activity[]>` | `GET /api/v1/dashboard/activity` | Returns recent activity entries |

---

## Jira jobs (`services/jiraJobs.ts`)

```ts
import {
  createJiraJob, getJiraJob, retryJiraJob, getJobLogs,
  createOperationJob, getOperationJobs, getAllJobsAdmin,
} from '@/services/jiraJobs'
```

| Function | Mock behavior | Real API | Description |
|---|---|---|---|
| `createJiraJob` | `setTimeout` simulation | `POST /api/v1/jira/jobs` | Enqueues a story + sub-task creation job |
| `getJiraJob` | Store lookup | `GET /api/v1/jira/jobs/:id` | Polls job state |
| `retryJiraJob` | Throws | `POST /api/v1/jira/projects/:id/retry-job` | Retries a failed job |
| `getJobLogs` | Empty array | `GET /api/v1/jira/jobs/:id/logs` | Fetches processing logs |
| `createOperationJob` | N/A | `POST /api/v1/jira/projects/:id/operation-jobs` | Creates a change-request job |
| `getOperationJobs` | N/A | `GET /api/v1/jira/projects/:id/operation-jobs` | Lists CR jobs |
| `getAllJobsAdmin` | Empty array | `GET /api/v1/admin/jira-jobs` | Admin dashboard: all jobs with logs |

See [../shared/jira-integration.md](../shared/jira-integration.md) for the full job lifecycle.

---

## Email templates (`services/emailService.ts`)

```ts
import {
  getEmailTemplates, getEmailTemplate,
  createEmailTemplate, saveEmailTemplate, deleteEmailTemplate,
  sendTestEmail,
} from '@/services/emailService'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getEmailTemplates` | `() => Promise<EmailTemplate[]>` | `GET /api/v1/email-templates` | Returns all templates |
| `getEmailTemplate` | `(id: string) => Promise<EmailTemplate>` | `GET /api/v1/email-templates/:id` | Returns a single template; throws if not found |
| `createEmailTemplate` | `() => Promise<EmailTemplate>` | `POST /api/v1/email-templates` | Creates a blank template and adds it to the mock store |
| `saveEmailTemplate` | `(template: EmailTemplate) => Promise<EmailTemplate>` | `PUT /api/v1/email-templates/:id` | Persists the full template |
| `deleteEmailTemplate` | `(id: string) => Promise<void>` | `DELETE /api/v1/email-templates/:id` | Removes the template |
| `sendTestEmail` | `(payload: SendTestEmailPayload) => Promise<void>` | `POST /api/v1/email-templates/send-test` | Sends a rendered HTML test email to a recipient |
| `sendEmail` | `(payload: SendEmailPayload) => Promise<void>` | `POST /api/v1/email-templates/send` | Sends a rendered HTML email (for actual triggers) |

### Email sending

Both `sendTestEmail` and `sendEmail` always call the backend API. The backend handles SMTP delivery using `aiosmtplib` with settings from its environment variables (`SMTP_HOST`, `SMTP_PORT`, etc.). The caller pre-renders the template HTML using `generateEmailHtml()` and resolves the subject before calling either function.

In mock mode (`USE_MOCK=true`), both functions wait 800 ms and silently succeed.

`SendTestEmailPayload`:

```ts
interface SendTestEmailPayload {
  templateId: string
  recipientEmail: string
  sampleData?: Record<string, string | Record<string, unknown>[]>
  htmlContent: string   // pre-rendered email HTML
  subject?: string      // resolved subject line (variables substituted)
}
```

`SendEmailPayload`:

```ts
interface SendEmailPayload {
  templateId?: string
  toEmails: string[]
  subject?: string
  htmlContent: string   // pre-rendered email HTML
}
```

---

## Category Milestones (`services/categoryMilestones.ts`)

```ts
import {
  getCategoryMilestones, createCategoryMilestone,
  updateCategoryMilestone, deleteCategoryMilestone,
  batchAssignCategoryMilestone,
} from '@/services/categoryMilestones'
```

| Function | Signature | Endpoint | Description |
|---|---|---|---|
| `getCategoryMilestones` | `() => Promise<CategoryMilestone[]>` | `GET /api/v1/category-milestones` | Returns all category milestones |
| `createCategoryMilestone` | `(data: Omit<CategoryMilestone, 'id' \| 'createdAt'>) => Promise<CategoryMilestone>` | `POST /api/v1/category-milestones` | Creates a new category milestone |
| `updateCategoryMilestone` | `(id, patch) => Promise<CategoryMilestone>` | `PATCH /api/v1/category-milestones/:id` | Updates fields on a category milestone |
| `deleteCategoryMilestone` | `(id: string) => Promise<void>` | `DELETE /api/v1/category-milestones/:id` | Removes the milestone and all project associations |
| `batchAssignCategoryMilestone` | `(cmId, projectIds, unassign?) => Promise<void>` | `POST /api/v1/category-milestones/batch-assign` | Assigns or unassigns the milestone from multiple projects |

All functions perform snake_case ↔ camelCase field mapping at the service boundary. Mock delays: create/update/delete use 200–300 ms.
