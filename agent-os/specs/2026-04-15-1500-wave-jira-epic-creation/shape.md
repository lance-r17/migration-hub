# Wave → Jira Epic Creation — Shaping Notes

## Scope

When a user creates a wave via `POST /api/v1/waves`, the backend automatically creates a Jira epic in the configured Jira project and stores the returned epic key (`jira_epic_key`) on the wave record.

## Decisions

- Real Jira Cloud REST API call (not mock) — POST `/rest/api/3/issue`
- If Jira call fails, the entire wave creation fails (HTTP 502); wave is NOT persisted
- If Jira is not configured (`JIRA_BASE_URL` empty), return HTTP 503
- Jira project key resolved from `body.jira_project_key`, falling back to `JIRA_PROJECT_KEY` env var
- Epic summary = wave name; description formatted as ADF if provided

## Context

- **Visuals:** None
- **References:** `backend/app/services/jira_service.py` (mock job processing pattern), `backend/app/auth.py` (httpx usage)
- **Product alignment:** Implements the Jira hierarchy defined in 2026-03-24-0000-wave-planning spec (Epic = Wave)

## Standards Applied

- N/A (no agent-os/standards/ directory exists)
