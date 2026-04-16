# Jira Story/Subtask Backend Integration — Shaping Notes

## Scope

When a Platform Migration Lead submits approval in `SignOffModal`, the frontend currently calls `createJiraJob()` in `jiraJobs.ts` which simulates async processing entirely client-side using `setTimeout`. This change routes that call through the real backend endpoint (`POST /api/v1/jira/jobs`) which uses FastAPI `BackgroundTasks`, persists job state to PostgreSQL, and updates the project record on completion.

Additionally, the `wave_epic_key` (the Jira epic key of the assigned wave) is stored on the `JiraJob` record so that parent links can be set correctly when real Jira API calls for stories and subtasks are added in a future phase.

## Decisions

- Mock data behavior is preserved — `jira_service._complete_job()` still generates random keys; no real Jira story/subtask API calls are made yet
- `jiraJobs.ts` is dual-mode: `USE_MOCK=true` uses the existing `setTimeout` simulation; `USE_MOCK=false` calls the backend
- `wave_epic_key` added to `JiraJob` DB model (requires Alembic migration) so parent link is available without re-fetching the wave
- `project_key` in `_complete_job()` is derived from `job.wave_epic_key` first (e.g. `"MIG-42" → "MIG"`), falling back to `project.jira_ticket`
- `jira_client.py` gains `create_story()` and `create_subtask()` stub methods with proper parent-link signatures, ready for the real integration phase
- Polling: frontend `ProjectDetailsPage.tsx` adds a `useEffect` that calls `refreshProject()` every 2s while `jiraJobStatus` is `pending` or `processing`

## Context

- **Visuals:** None
- **References:** `jiraJobs.ts` (frontend mock), `backend/app/routers/jira.py` (backend endpoint), `backend/app/services/jira_service.py` (process_job), `jira_client.py` (epic creation pattern)
- **Product alignment:** Implements the Jira hierarchy from 2026-03-24-0000-wave-planning spec — Epic = Wave, Story = Project, Subtask = CloudResource

## Standards Applied

- N/A (no agent-os/standards/ directory exists)
