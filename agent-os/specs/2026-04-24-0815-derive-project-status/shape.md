# Derive Project Status from Stage Progress — Shaping Notes

## Scope

Enhance project status presentation by:
1. Deriving `project.status` from `stageProgress` on the backend
2. Enhancing `StatusBadge` on the frontend with stage-aware contextual detail

## Decisions

- `blocked` is sticky/manual-only. Auto-derivation skips projects whose current status is `blocked`.
- Status derivation rules:
  - `setup === 0` → `planning`
  - `setup === 100 && survey < 100` → `in-progress`
  - `setup === 100 && survey === 100 && signoff < 100` → `in-progress`
  - `setup === 100 && survey === 100 && signoff === 100 && migration === 0` → `signed-off`
  - `setup === 100 && survey === 100 && signoff === 100 && migration > 0 && migration < 100` → `migrating`
  - `setup === 100 && survey === 100 && signoff === 100 && migration === 100` → `completed`
- Keep existing `ProjectStatus` type values — no new status enums needed.
- Frontend `StatusBadge` accepts an optional `stageProgress` prop to compute contextual detail text.

## Context

- **Visuals:** None
- **References:**
  - `backend/app/services/project_service.py` — `compute_stage_progress()`, `_recompute_and_store_progress()`
  - `backend/app/routers/projects.py` — `_project_list_item()`, `_project_detail()`
  - `frontend/src/components/shared/StatusBadge.tsx`
  - `frontend/src/components/home/ProjectCard.tsx`
  - `frontend/src/pages/ProjectDetailsPage.tsx`
- **Product alignment:** Aligns with Migration Hub mission of giving platform teams visibility into project progress. The roadmap mentions a "Migration progress dashboard" — accurate derived status is a prerequisite.

## Standards Applied

- N/A — no `agent-os/standards/` directory exists in this project.
