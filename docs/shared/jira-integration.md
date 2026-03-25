# Jira Integration

Migration Hub integrates with Jira to automatically create migration action items when a project is signed off. This document covers the full flow from sign-off to Jira issue creation.

## Overview

When the Platform Migration Lead completes their sign-off:

1. They choose a sub-task grouping strategy (resource-level, category-level, or custom)
2. The frontend enqueues a Jira job
3. The job runs asynchronously and creates a Jira story + sub-tasks linked to the project's wave epic
4. Sub-task keys are written back to each `CloudResource`
5. The project's `jiraStoryKey` is populated

---

## Wave epics

Every migration wave has a corresponding Jira epic. The wave's `jiraEpicKey` field holds the epic key (e.g. `MIG-42`). This is set in one of two ways:

- **Created wave**: `createWave()` calls the backend which creates a new Jira epic and returns its key
- **Imported wave**: `importWave(epicKey)` fetches metadata for an existing epic and creates the wave record

The Jira project key (e.g. `MIG`) is stored separately in `Wave.jiraProjectKey` — it is configured in the backend and not entered by users.

---

## Sign-off sub-task configuration

The Platform Migration Lead chooses one of three sub-task modes in the second step of `SignOffModal`:

| Mode | Sub-tasks created |
|---|---|
| `resource-level` | One sub-task per `CloudResource` where `needMigration !== false` |
| `category-level` | One sub-task per unique resource category among in-scope resources |
| `custom` | One sub-task per resource ID in `JiraSubtaskConfig.selectedResourceIds` |

The modal shows a live count of how many sub-tasks will be created for each mode.

---

## Jira job lifecycle

The job is created in `src/services/jiraJobs.ts` (`createJiraJob`). In mock mode it simulates the async backend queue with `setTimeout`:

```
Sign-off submitted
       │
       ▼
createJiraJob() called synchronously
       │
       ├─ Immediately: jiraJobStatus = 'pending'
       │
       ├─ ~5 seconds: jiraJobStatus = 'processing'
       │
       └─ ~30 seconds: jiraJobStatus = 'completed'
                │
                ├─ Project.jiraStoryKey = 'MIG-200'
                └─ CloudResource.jiraSubtaskKey = 'MIG-201', 'MIG-202', ...
```

`useProject` polls `getProject(id)` every 5 seconds while status is `'pending'` or `'processing'`. When the status transitions to `'completed'`, the toast notification is shown with the `jiraStoryKey`.

---

## Key generation (mock mode)

In mock mode, keys are generated locally:

- Story key: `${projectKey}-${random 3-digit number}` (e.g. `MIG-347`)
- Sub-task keys: sequential from `storyNum + 1` (e.g. `MIG-348`, `MIG-349`, ...)
- The project key is derived from `waveEpicKey.split('-')[0]`, defaulting to `'MIG'`

In production, the backend calls the real Jira API and returns the actual issue keys.

---

## Write-back to CloudResource

After job completion, each in-scope `CloudResource` has its `jiraSubtaskKey` field populated. The key mapping depends on the mode:

- **resource-level / custom**: `subtaskKeys[resource.id]`
- **category-level**: `subtaskKeys[resource.category]` (all resources in the same category share one key)

These keys are displayed in the Cloud Resources section so users can navigate directly to the Jira sub-task.

---

## Audit events

The following `AuditEventType` values relate to Jira:

| Event | Trigger |
|---|---|
| `wave_created` | A new wave is created (with Jira epic) |
| `wave_imported` | A wave is imported from an existing Jira epic |
| `wave_assigned` | A project is assigned to a wave |
| `jira_story_created` | Platform Lead sign-off triggers Jira job |

---

## Backend contract

When the FastAPI backend is built, it should expose:

### Wave creation
`POST /api/v1/waves`
- Accept wave fields (excluding `id`, `createdAt`, `jiraEpicKey`, `jiraProjectKey`)
- Create a Jira epic via the Jira API
- Return the full `Wave` with `jiraEpicKey` populated

### Wave import
`POST /api/v1/waves/import`
- Accept `{ epicKey: string }`
- Fetch epic metadata from Jira
- Return a `Wave` record

### Jira job creation
This is a backend-internal concern triggered by the sign-off endpoint (`PUT /api/v1/projects/:id/sections/approvals`). When all approvals are complete and a `JiraSubtaskConfig` is present:

1. Create a Jira story linked to the wave epic
2. Create sub-tasks according to the configured mode
3. Write story + sub-task keys back to the project and resources
4. Update `Project.jiraJobStatus` to `'completed'`

The frontend polls `GET /api/v1/projects/:id` to observe job progress.
