# Plan: Sign-off-disabled status display — bypass "Awaiting Sign-off"/"Signed-off", show "Ready for Migration"

## Context

When the **sign-off control** (`migrationSettings.signoffEnabled`) is turned off, the backend
(by design) folds sign-off into setup and reports `stageProgress.signoff = 100` for every
project. Consequently `derive_status_from_stage_progress` (`backend/app/services/project_service.py:186`)
still produces the real status value `signed-off` for projects with setup=100, survey=100,
migration=0 — and the frontend renders statuses like **"Awaiting Sign-off"** and **"Signed-off"**
even though the sign-off stage no longer exists.

Desired behavior: when sign-off is disabled, the statuses "awaiting sign-off" and "signed-off"
should be hidden/bypassed across the UI, and projects in that state should instead display
**"Ready for Migration"**.

Prior related work (already merged): `getProjectStage(project, signoffEnabled)` and
`ProjectStatusChartCard` are signoff-aware (stage donut hides the sign-off bucket) — see
`plans/homepage-progressive-loading.md`. This plan covers the project *status* layer.

## Approach (confirmed: display-layer remapping, no backend status change)

Keep the stored/derived `Project.status = 'signed-off'` unchanged (DB constraint, seed data,
dashboard stats, Jira trigger all rely on it). Remap at the presentation layer, exactly like
the existing `getProjectStage` pattern:

- `StatusBadge` / `getStatusLabel` accept `signoffEnabled?: boolean` (default `true`).
  When `false`, status `signed-off` renders as **"Ready for Migration"** (keeping the current
  emerald outline styling). The "Awaiting Sign-off" / "Survey Submitted" in-progress overrides
  can't fire when disabled (signoff is always 100), so no change needed there.
- ProjectsPage status filter: when sign-off is disabled, hide **Awaiting Sign-off**,
  **Survey Submitted** (can never match — requires `signoff === 0`), and **Signed Off**;
  show **Ready for Migration** instead (query value stays `signed-off`, which the backend
  filter already matches via `effective_status == status_filter`). If the active filter is
  one of the hidden values when the toggle is off, reset it to `all`.
- Thread `signoffEnabled` from pages that already load `migrationSettings`
  (HomePage, ProjectsPage, ProjectDetailsPage) into badge-consuming components.

## Files to modify

- `frontend/src/components/shared/StatusBadge.tsx` — `signoffEnabled` prop + label remap
  (+ `getStatusDetail` for `signed-off` already returns "Ready for migration"; revisit tooltip copy)
- `frontend/src/pages/HomePage.tsx` — pass `signoffEnabled` to `ProjectCard`
- `frontend/src/components/home/ProjectCard.tsx` — accept + forward `signoffEnabled` to
  `StatusBadge`; also filter the `signoff` row out of the `STAGES` progress tooltip when
  disabled (it currently shows "Sign-off 100%" for every project)
- `frontend/src/pages/ProjectsPage.tsx` — filter dropdown changes + pass `signoffEnabled` to
  `StatusBadge` + pass to export
- `frontend/src/lib/export-report.ts` — `exportProjectsToExcel(..., signoffEnabled?)` →
  `getStatusLabel(p.status, p.stageProgress, p.hasSurveyDraft, signoffEnabled)` so the Excel
  "Status" column matches the UI
- `frontend/src/pages/ProjectDetailsPage.tsx` — pass existing `signoffEnabled` to `StatusBadge` (line 375)
- `frontend/src/components/drawers/ProjectPreviewDrawer.tsx` — `StatusBadge` remap (via `useMigrationSettings`)
- `frontend/src/components/waves/WavePlanningBoard.tsx` — `StatusBadge` remap (via `useMigrationSettings`)

## Reuse

- `frontend/src/hooks/use-migration-settings.ts` — `useMigrationSettings()` hook (settings.signoffEnabled)
- `frontend/src/lib/project-stages.ts` — precedent: `getProjectStage(project, signoffEnabled = true)`
- `frontend/src/components/home/ProjectStatusChartCard.tsx` — precedent: `signoffEnabled` prop threading
- Backend filter `backend/app/services/project_service.py:558-564` — `signed-off` value already
  matches ready-for-migration projects; no backend change needed

## Steps

- [x] 1. `StatusBadge.tsx`: add `signoffEnabled?: boolean` (default `true`) to `StatusBadge`,
  `getStatusLabel`, and `getStatusDetail`; when `false`, `signed-off` renders as
  **"Ready for Migration"** (keep emerald outline styling; tooltip detail already says
  "Ready for migration")
- [x] 2. `ProjectCard.tsx` + `HomePage.tsx`: add `signoffEnabled` prop, pass from HomePage's
  `migrationSettings`, forward to `StatusBadge`, and drop the Sign-off row from the progress
  tooltip when disabled
- [x] 3. `ProjectsPage.tsx`: read `signoffEnabled` from the existing `migrationSettings`;
  hide Awaiting Sign-off / Survey Submitted / Signed Off filter options and show
  "Ready for Migration" (value `signed-off`) when disabled; reset `statusFilter` to `all`
  if it points at a hidden option; pass `signoffEnabled` to `StatusBadge` and to the export
- [x] 4. `export-report.ts`: add `signoffEnabled?: boolean` param to `exportProjectsToExcel`
  and forward to `getStatusLabel`
- [x] 5. Consistency pass on remaining `StatusBadge` consumers: `ProjectDetailsPage.tsx`
  (pass existing `signoffEnabled`, line 375), `ProjectPreviewDrawer.tsx` and
  `WavePlanningBoard.tsx` (use `useMigrationSettings`)

## Verification

- Toggle sign-off off in Migration Settings →
  - HomePage project cards show "Ready for Migration" (no "Signed-off"), and the progress
    tooltip has no Sign-off row
  - ProjectsPage badges show "Ready for Migration"; the status filter shows "Ready for
    Migration" and hides Awaiting Sign-off / Survey Submitted / Signed Off; selecting it
    returns the expected projects; Excel export Status column says "Ready for Migration"
  - ProjectDetailsPage header badge, ProjectPreviewDrawer, and WavePlanningBoard badges agree
- Toggle sign-off on → all pages behave exactly as before.
- `cd frontend && npm run build` (typecheck) passes.
