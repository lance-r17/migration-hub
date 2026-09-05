# Plan: HomePage performance tuning (minimize API response size)

## Context

Deep-dive finding: `GET /projects/home` returns ~413 KB for a lead (205 projects),
of which ~50% is never rendered (`risks` 25%, `approvals` 24% — lead-chart only,
`migration_constraints` 15% — only 2 dates used, `planning` 7% — only 2 dates used).
`/dashboard/stats` additionally recomputes per-project progress server-side for all
projects — work already done by `/home` — and blocks first paint via `dashLoading`.

Measured per-key sizes (dev DB): risks 104 KB, approvals 103 KB,
migration_constraints 65 KB, team 41 KB, planning 29 KB, description 16 KB.

Goal: cut the HomePage payload to ~90 KB for leads (≈78% reduction) and
proportionally less for other roles, with zero rendering/export regressions.

Safety invariants (verified):
- Report exports use `getProjects([...])` → `/api/v1/projects` (list endpoint,
  own field sets) — untouched by `/home` changes (`export-report.ts`).
- `/projects/home` is consumed only by HomePage (`useProjects({home:true})`).
- `ProjectHomeItem` schema fields are all optional → omitting keys is safe.
- `OverallProgressCard` reads only `stats.progress`.
- Mock mode unaffected in behavior (store returns full mock data; field lists are
  ignored in mock).

## Approach

### 1. Frontend — role-conditional field sets (`HomePage.tsx`)

Replace the single field list with role-based sets:
- **Leads** (platform/bgi): `['basic', 'progress', 'team', 'approvals', 'engagement']`
  — approvals feed `getSignoffCompletionDate` in the activity chart; engagement
  feeds the activity chart + status chart.
- **Non-leads**: `['basic', 'progress', 'team']` — rich cards need nothing else.
- Drop `risks` (unused) and `planning` (no-op key; planning arrives via `basic`)
  for all roles.

### 2. Backend — trim `/projects/home` `basic` block (fields branch only)

In `_project_home_item` (`backend/app/routers/projects.py`, fields branch;
leave the `fields=None` full-payload branch untouched):
- `planning` → `_trim_keys(p.planning, ("startDate", "endDate"))` (reuse existing
  `_trim_keys` helper, same as `_TABLE_PLANNING_KEYS` pattern).
- `migration_constraints` → `_trim_keys(p.migration_constraints, ("earliestStartDate", "latestEndDate"))`.
- Remove from `basic`: `description`, `jira_base_url`, `data_migration_schedule`,
  `data_migration_plan`, `data_migration_survey_submitted_by`,
  `environment_provision`, `justification_without_survey` — none are read on
  HomePage.
- Keep: `id, name, status, blocked_reason, migration_wave, wave_id,
  jira_story_key, jira_job_status, survey_submitted_at, is_survey_needed,
  data_migration_survey_submitted_at, updated_at` (all consumed or trivial).

### 3. Frontend — compute overall stats client-side for ALL roles

- HomePage: drop `useDashboard`'s stats dependency; fetch activity only.
  Extend `useDashboard` with `withStats?: boolean` (default true) — when false,
  skip `getOverallStats()` and return `stats: undefined` without blocking
  `loading` on it. HomePage calls `useDashboard({ enabled: isPlatformLead, withStats: false })`.
- Generalize `scopedStats` to all roles: `displayStats` = client-side average of
  `projects` progress + `completed`/`inProgress` counts (`completed`,
  `['in-progress','migrating','signed-off']` — same status sets as backend
  `compute_stats`). Behavior identical for non-platform-leads; for platform leads
  replaces the backend average (same semantics — home returns all projects for
  leads; ±1% edge possible from JS vs Python rounding).
- Remove the now-unused `targetCloud` fallback dependency on `globalStats`.

### 4. Correctness fixes (confirmed in scope)

- **`resource_count`**: rich non-lead cards show "0 assets" today (resources
  never requested). Add `resource_count: int | None` to `ProjectHomeItem`,
  emitted in `basic` as `len(p.cloud_resources or [])`; add `cloud_resources`
  to the `basic` rel requirements in `_FIELD_REL_REQUIREMENTS` (count only —
  no rows in payload). Frontend: `Project.resourceCount?: number`,
  `fromApiListItem` maps `raw.resource_count`, `ProjectCard` uses
  `project.resourceCount ?? 0`.
- **updatedAt sort**: home `updated_at` is a `"05 DEC 2026"` display string and
  HomePage sorts it with `localeCompare` (alphabetical ≠ chronological). Emit
  `p.updated_at.isoformat()` in the home `basic` block instead (schema is
  `str | None`; the formatted string is not displayed anywhere from the home
  payload — only sorted on).

## Files to modify

- `frontend/src/pages/HomePage.tsx` — field sets, client stats
- `frontend/src/hooks/use-dashboard.ts` — `withStats` option
- `frontend/src/hooks/use-projects.ts` — pass-through (no change expected; verify)
- `backend/app/routers/projects.py` — `_project_home_item` basic trim, resource_count, updated_at ISO
- `backend/app/services/project_service.py` — `_FIELD_REL_REQUIREMENTS` basic → cloud_resources
- `frontend/src/types/index.ts` — `Project.resourceCount`
- `frontend/src/services/projects.ts` — `ProjectListItemApi.resource_count` mapping
- `frontend/src/components/home/ProjectCard.tsx` — resourceCount usage

## Reuse

- `_trim_keys` (`backend/app/routers/projects.py:497`) — key trimming.
- `scopedStats` memo (`HomePage.tsx:229`) — client-side average, generalize it.
- `getSignoffCompletionDate` (`frontend/src/utils/dates.ts`) — unchanged; approvals
  stay for leads.

## Steps

- [x] 1. HomePage: role-conditional field sets (drop risks/planning keys)
- [x] 2. Backend: trim `_project_home_item` basic block (planning, migration_constraints, drop unused keys)
- [x] 3. useDashboard `withStats` option; HomePage client-side stats for all roles
- [x] 4. resource_count end-to-end + updated_at ISO sort fix
- [x] 5. Verify: backend pytest, frontend tsc/lint, payload re-measurement, role walkthrough

## Verification

- `cd backend && .venv/bin/python -m pytest -q` (regressions; payload-shape tests if any)
- `cd frontend && npx tsc --noEmit`; lint problem count unchanged (199)
- Re-run the payload measurement script against dev DB: confirm ~78% reduction for
  leads, larger for non-leads
- Manual per role (platform lead / bgi lead / member): HomePage renders overall %,
  status chart, activity chart, project cards; all 7 export reports produce files
- Mock mode (`USE_MOCK`): HomePage unchanged

## Open questions

None — fixes 4a/4b confirmed in scope.
