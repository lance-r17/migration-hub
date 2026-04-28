# Jira Integration

Migration Hub integrates with Jira to create epics, stories, sub-tasks, and change-request tickets. This document covers the full flow from wave creation through sign-off to operational CRs.

---

## Overview

| Phase | Action | Actor |
|---|---|---|
| **Wave planning** | Create or import a wave → Jira epic is created or linked | Platform Migration Lead |
| **Project sign-off** | All three approvals complete → async Jira job creates story + sub-tasks | Platform Migration Lead |
| **Resource migration** | Individual resources marked synced → sub-task optionally closed | Project team |
| **Change request** | Select sub-tasks → async operation job creates a CR ticket | Platform Migration Lead |

---

## Wave epics

Every migration wave has a corresponding Jira epic. The wave's `jiraEpicKey` holds the epic key (e.g. `MIG-42`).

| Source | Behavior |
|---|---|
| **Created** | `POST /api/v1/waves` creates a new epic via the Jira API and returns its key |
| **Imported** | `POST /api/v1/waves/import` links an existing epic by key |

The Jira project key (e.g. `MIG`) is configured via the `JIRA_PROJECT_KEY` env var; users do not enter it.

---

## Sign-off sub-task configuration

The Platform Migration Lead chooses a grouping mode in `SignOffModal`:

| Mode | Sub-tasks created |
|---|---|
| `resource-level` | One per `CloudResource` where `needMigration !== false` |
| `category-level` | One per unique `ResourceCategory` among in-scope resources |
| `product-level` | One per unique `product` among in-scope resources |
| `custom` | One per resource ID in `selectedResourceIds` |

The modal shows a live count for each mode.

---

## Jira job lifecycle

### Story job

```
Sign-off submitted
       │
       ▼
POST /api/v1/jira/jobs
       │
       ├─ Immediately: jiraJobStatus = 'pending'
       │
       ├─ Backend BackgroundTask starts: jiraJobStatus = 'processing'
       │
       └─ Completed: jiraJobStatus = 'completed'
                │
                ├─ Project.jiraStoryKey = 'MIG-200'
                ├─ CloudResource.jiraSubtaskKey populated
                └─ Audit entry: jira_story_created
```

`useProject` polls `getProject(id)` every 5 seconds while status is `'pending'` or `'processing'`.

### Operation job (change request)

After the story is complete, the Platform Lead can select sub-tasks and create a change-request ticket:

```
POST /api/v1/jira/projects/:id/operation-jobs
       │
       ├─ Immediately: OperationJob status = 'pending'
       │
       └─ Completed: OperationJob status = 'completed'
                │
                └─ OperationJob.crSubtaskKey = 'MIG-250'
```

---

## Mock mode simulation

When `USE_MOCK` is true, `createJiraJob` simulates the backend queue client-side:

- **0 ms:** `jiraJobStatus = 'pending'`
- **~5 s:** `jiraJobStatus = 'processing'`
- **~30 s:** `jiraJobStatus = 'completed'`, mock keys generated

Mock keys follow the pattern `${projectKey}-${random 3-digit}` with sequential sub-task keys.

---

## Write-back to CloudResource

After job completion, each in-scope `CloudResource` gets a `jiraSubtaskKey`:

| Mode | Key mapping |
|---|---|
| `resource-level` / `custom` | `subtaskKeys[resourceId]` |
| `category-level` | `subtaskKeys[category]` |
| `product-level` | `subtaskKeys[product]` |

---

## Frontend service API

All Jira interactions go through `frontend/src/services/jiraJobs.ts`:

| Function | Mock | Real API | Description |
|---|---|---|---|
| `createJiraJob` | `setTimeout` simulation | `POST /api/v1/jira/jobs` | Enqueues story + sub-task creation |
| `getJiraJob` | Store lookup | `GET /api/v1/jira/jobs/:id` | Polls job state |
| `retryJiraJob` | Throws | `POST /api/v1/jira/projects/:id/retry-job` | Retries a failed job |
| `getJobLogs` | Empty array | `GET /api/v1/jira/jobs/:id/logs` | Fetches processing logs |
| `createOperationJob` | N/A | `POST /api/v1/jira/projects/:id/operation-jobs` | Creates a change-request job |
| `getOperationJobs` | N/A | `GET /api/v1/jira/projects/:id/operation-jobs` | Lists CR jobs for a project |
| `getAllJobsAdmin` | Empty array | `GET /api/v1/admin/jira-jobs` | Admin dashboard: all jobs with logs |

---

## Backend endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/jira/jobs` | Create a Jira story job |
| `GET` | `/api/v1/jira/jobs/:id` | Get job by ID |
| `GET` | `/api/v1/jira/jobs/:id/logs` | Get job logs |
| `POST` | `/api/v1/jira/projects/:id/retry-job` | Retry a failed job |
| `POST` | `/api/v1/jira/projects/:id/operation-jobs` | Create a change-request job |
| `GET` | `/api/v1/jira/projects/:id/operation-jobs` | List CR jobs |
| `GET` | `/api/v1/admin/jira-jobs` | Admin: all jobs with logs |

---

## Audit events

| Event | Trigger |
|---|---|
| `wave_created` | New wave created (with Jira epic) |
| `wave_imported` | Wave linked to existing epic |
| `wave_assigned` | Project assigned to a wave |
| `jira_story_created` | Sign-off triggers Jira story job |

---

## Environment variables

| Variable | Description |
|---|---|
| `JIRA_BASE_URL` | Jira instance URL |
| `JIRA_API_TOKEN` | API token for Jira REST API |
| `JIRA_USER_EMAIL` | Email for Jira API auth |
| `JIRA_PROJECT_KEY` | Default project key (e.g. `MIG`) |
