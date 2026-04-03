# Plan: Jira Clickable Links + M-11029 Status Update

## Context
Two related changes:
1. Project M-11029 currently has `status: 'signed-off'` in mock data — update to `'in-progress'`.
2. Jira story keys (`jiraStoryKey`, `jiraTicket`) and Jira sub-task keys (`jiraSubtaskKey` per resource) are currently rendered as non-clickable code badges in the Project Details page. They need to be clickable links pointing to the actual Jira ticket page. The Jira base URL is backend-owned — the frontend will receive it as part of the project data.

## Tasks

### Task 1: Update M-11029 status
`frontend/src/data/mock.ts` — change `status: 'signed-off'` → `status: 'in-progress'`

### Task 2: Add `jiraBaseUrl` to Project type + mock data
- `frontend/src/types/index.ts` — add `jiraBaseUrl?: string` to Project interface
- `frontend/src/data/mock.ts` — add `jiraBaseUrl` to M-11029 and PRJ-2024-ALPHA

### Task 3: Clickable links in ProjectDetailsPage
`frontend/src/pages/ProjectDetailsPage.tsx` — wrap `jiraStoryKey` and `jiraTicket` badges as `<a>` links when `jiraBaseUrl` is set

### Task 4: Clickable links in CloudResourcesSection
`frontend/src/components/project/CloudResourcesSection.tsx` — add `jiraBaseUrl` prop, make story key in banner and `jiraSubtaskKey` per resource clickable

### Task 5: Wire up prop
`frontend/src/pages/ProjectDetailsPage.tsx` — pass `jiraBaseUrl={project.jiraBaseUrl}` to `<CurrentInfrastructureSection>`
