# Jira Job Queue Simulation — Async Story & Sub-task Creation

## Context

After the Platform Migration Lead completes sign-off + configures Jira sub-tasks, the current implementation uses a one-shot 800ms mock delay. This simulates the real event-driven production flow:

1. Frontend submits → writes a job request record to DB (store)
2. Background consumer job picks up the request from the queue
3. Consumer calls Jira API, writes back story key + sub-task keys to DB
4. Frontend polls and reflects the result when ready

## Simulation Delays

- ~5s: status → 'processing'
- ~30s: status → 'completed', story key + subtask keys written back

## Tasks

1. Save spec documentation
2. Types: add `jiraSubtaskKey` to CloudResource, `jiraStoryKey`/`jiraJobStatus` to Project, `JiraJobRequest` to wave.ts
3. Store: add `_jiraJobs` collection + CRUD methods
4. Service: create `jiraJobs.ts` with `createJiraJob()` using setTimeout
5. Polling: add setInterval effect to `useProject` when jiraJobStatus is pending/processing
6. ProjectDetailsPage: replace handleConfirmWithJira, add completion toast, pass props
7. CloudResourcesSection: add banner + Jira Sub-task column
