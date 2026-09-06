# Plan: HomePage progressive loading (Option A) + sign-off stage-diagram fix

## Context

**A. Progressive loading (platform lead).** The platform-lead HomePage waits for the
full project list (~310 KB) before rendering anything, but only 5 project cards are
shown. Goal: render cards instantly from a light "top 5 + total count" call; the
full list lazy-loads to feed the two chart cards. (Report exports are unaffected —
they self-fetch via `getProjects([...])` at click time; no dropdown disabling
needed.)

**B. Bug: stage distribution donut wrong when sign-off is disabled.** With sign-off
off, the backend (by design) reports `stage_progress.signoff = 100` for every
project. `getProjectStage()` (`frontend/src/lib/project-stages.ts:19`) checks
`signoff === 100` (and `status === 'signed-off'`) before survey, so ~all projects
land in the "sign-off" bucket (user sees: sign-off 99%, migration 1%). Expected:
the sign-off stage disappears and projects distribute over
setup/survey/migration/completed (as they do when the toggle is on).

## Approach

### B. Stage-diagram fix (small, do first)

- `getProjectStage(project, signoffEnabled = true)`: when `false`, skip both
  sign-off conditions (`status === 'signed-off'` and `stageProgress.signoff === 100`)
  so such projects fall through to survey/migration/completed.
- `ProjectStatusChartCard`: accept `signoffEnabled` prop (HomePage already has
  `migrationSettings?.signoffEnabled`); filter the `sign-off` entry out of
  `STAGE_META` when disabled.
- Note: project *status* still becomes `signed-off` server-side when sign-off is
  disabled (by design — folded); only the diagram grouping changes.
- Confirmed: the ProjectCard progress tooltip keeps showing all four stage rows
  (incl. "Sign-off 100%") when sign-off is disabled — out of scope.

### A. Progressive loading (platform lead only)

**Backend** — new endpoint `GET /api/v1/projects/home-summary`
(`routers/projects.py` + `project_service.py`):
- Response: `{ projects: ProjectHomeItem[5], total: int }` (new schema
  `ProjectHomeSummary` in `schemas/project.py`).
- Query: `status != 'completed'` (stored status — kept fresh by
  `_derive_and_store_status`), order `updated_at desc`, limit 5; serialize with
  `_project_home_item(p, fields={'basic','progress','team'}, ctx)`.
  `total` = `count(*)` over all projects (platform lead sees all).
- Eager-load the rels those fields need (reuse `_resolve_rels`).

**Frontend**:
- `services/projects.ts`: `getProjectsHomeSummary()` (mock mode: derive from
  `store.getProjects()` — active, updatedAt desc, slice 5, total = length).
- `HomePage.tsx` (platform lead path only):
  - Fetch summary → render the project grid (5 compact cards + "View All Projects"
    count card) as soon as it arrives; grid skeleton only waits on summary.
  - Full list keeps loading for the charts; Section 1 cards skeleton until
    `projectsLoading` done. Charts/stats wiring unchanged (`displayStats`,
    `OverallProgressCard`, `ProjectStatusChartCard` consume the full list).
  - The full-list fetch for platform leads drops `team` (cards now come from the
    summary): fields `['basic','progress','approvals','engagement']`.
  - Non-platform-leads (BGI lead, members) keep the current single full fetch —
    BGI leads need the full scoped list for the client-side tree filter, members
    render all their rich cards. (Confirmed: platform lead only.)
  - Grid order for platform leads = server order (updated_at desc) — same as today
    (the Sort dropdown already doesn't affect the lead grid; unchanged).

## Files to modify

- `frontend/src/lib/project-stages.ts` — signoff-aware `getProjectStage`
- `frontend/src/components/home/ProjectStatusChartCard.tsx` — prop + STAGE_META filter
- `frontend/src/pages/HomePage.tsx` — summary fetch, split loading gates, field sets
- `frontend/src/services/projects.ts` — `getProjectsHomeSummary`
- `backend/app/routers/projects.py` — `/home-summary` endpoint
- `backend/app/services/project_service.py` — lean summary query
- `backend/app/schemas/project.py` — `ProjectHomeSummary`
- `backend/tests/` — extend home/table tests for summary endpoint

## Reuse

- `_project_home_item` + `_resolve_rels` + `get_progress_context` (backend).
- `store.getProjects()` for mock summary.
- Existing `Skeleton` gating pattern in HomePage.

## Steps

- [x] 1. Fix `getProjectStage` + `ProjectStatusChartCard` sign-off-awareness
- [x] 2. Backend `/projects/home-summary` (schema, service query, router)
- [x] 3. Frontend service + HomePage progressive rendering (platform lead)
- [x] 4. Tests + verify (pytest, tsc/lint, payload check, role walkthrough)

## Verification

- Bug: toggle sign-off off → donut shows setup/survey/migration/completed only,
  no sign-off bucket; on → unchanged. Stepper behavior unchanged.
- Platform lead: cards render before full list arrives (network throttle check);
  charts appear after; count card correct; exports work immediately on click.
- BGI lead + member: unchanged behavior.
- `cd backend && pytest -q`; `cd frontend && npx tsc --noEmit` + lint unchanged (199).
