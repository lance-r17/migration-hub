# Block/Unblock Project — Shaping Notes

## Scope

Add Block/Unblock functionality for projects, restricted to Platform Migration Leads. When unblocking, the status is auto-derived from stage progress.

## Decisions

- Block/Unblock action lives **only on Project Details Page**
- Only `platform_migration_lead` role can block or unblock
- When unblocking, derive the correct status from `stageProgress`
- Reuse existing `PATCH /projects/{id}/sections/{key}` endpoint
- Backend overrides the PATCHed status value when unblocking, ensuring correctness

## Context

- **Visuals:** None
- **References:**
  - `backend/app/routers/projects.py` — `update_section()`, `update_project()`
  - `frontend/src/pages/ProjectDetailsPage.tsx` — metadata strip, `isPlatformLead`
  - `backend/app/services/project_service.py` — `derive_status_from_stage_progress()`
- **Product alignment:** Aligns with Migration Hub's role-based access control. Platform leads need the ability to flag projects as blocked without affecting the underlying stage progress data.

## Standards Applied

- N/A — no `agent-os/standards/` directory exists in this project.
