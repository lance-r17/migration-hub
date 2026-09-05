# Plan: Configurable Progress Weights, Sign-off Merge, Milestone Presets & Export

## Context

Project progress is computed backend-side in `compute_stage_progress()`
(`backend/app/services/project_service.py:120`) with hardcoded weights
`{setup: 5, survey: 15, signoff: 10, migration: 70}`, where migration % =
completed cloud resources. Meanwhile the migration step of `StageProgressStepper`
(ProjectDetailsPage) and the `%` column of the Wave Gantt project row both use
**milestone-duration completion** (`projectMilestoneDurationStats` in
`frontend/src/lib/milestones.ts`). Sign-off enablement lives on a separate
settings page/endpoint.

Decisions confirmed with user:
1. Merge sign-off switch into the Platform Migration card of MigrationSettingsPage;
   delete `SignoffSettingsPage`, its route and nav card.
2. **Option B**: backend owns the new progress computation so *all* surfaces
   (HomePage cards, Overall Progress, Projects table, dashboard stats) match —
   weights configurable, migration % = milestone-duration completion (ported to Python).
3. When sign-off is disabled: Jira switch is **disabled AND forced off**.
4. `signoffEnabled` folds into the migration settings payload (single endpoint);
   the `/api/v1/settings/signoff` endpoint is removed.
5. Projects with no milestones → migration contribution 0% (matches stepper).
6. Milestone export: `{projects:[{projectId, milestones:[...]}]}`, importable types
   only (presets + custom), excluding auto-derived rows.
7. Settings UI shows hint text for weight folding; inputs stay as configured.

Weight model: `preparation` (input) + `migration = 100 − preparation` (derived);
`setup + survey + signoff == preparation` (validated). Defaults 30/5/15/10
reproduce today's 5/15/10/70. Redistribution at compute time:
- `project.is_survey_needed == false` → survey weight folds into setup.
- sign-off disabled → signoff weight folds into setup.

## Approach

### A. Backend — settings payload

- `backend/app/schemas/migration_settings.py`:
  - New `ProgressWeights(BaseModel)`: `preparation, setup, survey, signoff: int`
    (each 0–100) + model validator `setup + survey + signoff == preparation`.
  - `MigrationSettingsOut` / `MigrationSettingsUpdate`: add
    `signoff_enabled: bool = True` and `progress_weights: ProgressWeights`.
- `backend/app/services/migration_settings_service.py`: extend `_DEFAULT` with
  `"signoff_enabled": True` and
  `"progress_weights": {"preparation": 30, "setup": 5, "survey": 15, "signoff": 10}`;
  handle both fields in get/update (existing additive pattern, ConfigStore JSON —
  no DB migration).
- Remove signoff endpoint: delete `GET/PUT /settings/signoff` from
  `backend/app/routers/billing.py` (lines 105–112), delete
  `backend/app/services/signoff_service.py` and `backend/app/schemas/signoff.py`;
  clean up imports. Grep for remaining references.
- `backend/app/mcp/tools/dashboard.py:160`: add the two new fields to the exposed
  settings payload.

### B. Backend — milestone-duration stats (Python port of `frontend/src/lib/milestones.ts`)

New `backend/app/services/milestone_stats.py`, mirroring the frontend exactly:
- `milestone_duration_days(start, end)` — inclusive ends: `max(1, days + 1)`.
- `build_environment_provision_milestones(project)` — from
  `environment_provision` JSONB; replicate frontend `normalizeEnvironmentProvision`
  first (both shapes: `{dev:{date,completedAt}, prod:{...}}` and legacy
  `{environments:[...], date, completedAt}`), then the frontend rules
  (`completedAt` → done; `date <= today` → in-progress; else todo).
- `build_data_migration_period_milestone(project)` — from
  `data_migration_plan ?? data_migration_schedule` (`startDate`/`endDate`,
  `cycleBlocks[].startDate/endDate`, `completedAt`); same status rules.
- `get_milestone_rows(project)` — category milestones (relationship, sorted by
  `created_at`, per-project overrides from `planning["categoryMilestoneOverrides"]`)
  + env-provision + data-migration-period + `planning["milestones"]` (excluding
  persisted CM copies), ordered by `planning["milestoneRowOrder"]`
  (port `orderByIdList`).
- `project_milestone_duration_stats(project)` → `(total, done) | None`;
  done = rows with `status == "done"`.

### C. Backend — weighted progress

- `project_service.compute_stage_progress(project, *, weights, signoff_enabled)`:
  - setup/survey/signoff sub-stage rules unchanged.
  - **survey treated as 100 when `project.is_survey_needed` is false; signoff
    treated as 100 when sign-off disabled** (required so
    `derive_status_from_stage_progress` can still reach signed-off/migrating/
    completed — the "folds into setup" semantics).
  - migration = `round(done/total*100)` from milestone stats, else 0.
  - effective weights: `w_mig = 100 − preparation`;
    `w_setup = setup + (survey if not needed) + (signoff if disabled)`;
    `w_survey = 0 if not needed else survey`; `w_signoff = 0 if disabled else signoff`.
  - `overall = round(setup·w_setup/100 + survey·w_survey/100 + signoff·w_signoff/100 + migration·w_mig/100)`.
- Thread settings through all call sites — add helper
  `get_progress_context(session) -> (ProgressWeights, bool)` wrapping
  `migration_settings_service.get_migration_settings` (one ConfigStore read per
  request). Call sites: `routers/projects.py` (`_derive_status` callers,
  `_project_list_item`, `_project_home_item`, fields-branches ~lines 155–166,
  233–237, 302–371, 405–430, 520–521, 846–849, 1162),
  `project_service.py` (`_derive_and_store_status` line 181, lines 587–591),
  `dashboard_service.compute_stats` (line 29).
- `project_service.get_all_for_stats` (line 643): add
  `selectinload(Project.category_milestones)`. (`get_all`/`get_all_home`/
  `get_by_id` already eager-load them.)
- `derive_status_from_stage_progress` logic unchanged (consumes adjusted stage values).
- Seed script `scripts/seed_data/generate_projects.py` has its own local
  `compute_stage_progress` for fixture generation — leave unchanged (progress is
  recomputed at runtime).

### D. Frontend — settings UI & cleanup

- `frontend/src/types/settings.ts`: add `signoffEnabled: boolean`,
  `progressWeights: { preparation, setup, survey, signoff }`; delete `SignoffConfig`.
- `frontend/src/services/migrationSettings.ts`: map `signoff_enabled` and
  `progress_weights` in `fromApi`/`toApi`.
- Delete `frontend/src/services/signoffConfig.ts` and
  `frontend/src/pages/SignoffSettingsPage.tsx`; remove route `settings/signoff`
  (`App.tsx:109`) and the "Sign-off Control" nav card (`SettingsHome.tsx:37`).
- `frontend/src/data/store.ts` (mock mode): remove signoff accessors; add
  `signoffEnabled: true` + `progressWeights` defaults to `_migrationSettings`.
  (Mock-mode progress numbers stay hardcoded — no backend to recompute.)
- `frontend/src/pages/MigrationSettingsPage.tsx` (Platform Migration card):
  - Add "Enable sign-off workflow" switch above the Jira switch (bind
    `config.signoffEnabled`).
  - Jira switch: `disabled={!config.signoffEnabled}`; toggling sign-off **off**
    also sets `createJiraStoriesOnSignoff: false` (forced off); hint text
    "Requires the sign-off workflow to be enabled."
  - New "Progress Weights" section: Preparation % input; read-only derived
    Migration % (`100 − preparation`); Setup/Survey/Sign-off % inputs; inline
    error + block Save when `setup + survey + signoff ≠ preparation`; hint text:
    "Survey weight folds into Setup for projects that don't require a survey.
    Sign-off weight folds into Setup when sign-off is disabled."
  - Update `DEFAULTS`; single Save → `saveMigrationSettings` + context refresh.
- `frontend/src/pages/ProjectDetailsPage.tsx`: drop `getSignoffConfig` fetch
  (line 141); derive `signoffEnabled = migrationSettings?.signoffEnabled ?? true`
  (`useMigrationSettings` already present, line 88).
- HomePage/ProjectCard: **no change needed** — backend now returns
  weights-based `progress` and milestone-based `stage_progress.migration`;
  card, tooltip, `scopedStats` average, and Overall Progress all stay consistent.

### E. Gantt — new presets (point 4)

- `frontend/src/types/index.ts:311`: add `'dev-big-data-migration'` and
  `'prd-big-data-migration'` to `MilestoneType`.
- `frontend/src/lib/milestones.ts` `MILESTONE_TYPE_META`: add both entries
  (Database-family icons, distinct colors, short labels).
- `frontend/src/components/waves/WaveGanttChart.tsx` `MILESTONE_PRESETS`
  (line 112): insert "Data Migration - Big data (Dev)" directly **after**
  `dev-data-migration`; "Data Migration - Big data (Prod)" directly **before**
  `prd-cutover`. Import compatibility is automatic (`importableTypes` derives
  from `MILESTONE_PRESETS`; `fixedMilestoneId` gives deterministic ids).
- Update `IMPORT_SAMPLE_JSON` (WaveGanttChart.tsx:138) and
  `docs/frontend/samples/milestone-import.sample.json` to include the new types.
- Backend needs no change: `planning` is raw JSONB, no milestone-type enum.

### F. Gantt — "Download milestone data" (point 5)

- In the project-row action `DropdownMenu` (~WaveGanttChart.tsx:2963), add
  "Download milestone data" (Download icon, available regardless of wave
  assignment; place above "Remove from wave").
- Handler: from `getEffectivePlanning(p).milestones`, keep importable types
  (`MILESTONE_PRESETS` types, incl. `custom`); map to import shape —
  presets: `{type, start, end, status, deps, comments?}`; custom adds `{id, name}`.
  Wrap as `{ projects: [{ projectId: p.id, milestones }] }`; download
  `<projectId>-milestones.json` reusing the Blob pattern from
  `downloadImportSample` (line 1079). Toast if nothing to export.
- Deps referencing auto-derived rows (env-provision etc.) are kept as-is; on
  re-import they're ignored with a warning (existing import behavior).

## Files to modify

**Backend**
- `backend/app/schemas/migration_settings.py`
- `backend/app/services/migration_settings_service.py`
- `backend/app/services/milestone_stats.py` (new)
- `backend/app/services/project_service.py`
- `backend/app/services/dashboard_service.py`
- `backend/app/routers/projects.py`, `backend/app/routers/billing.py`
- `backend/app/mcp/tools/dashboard.py`
- delete: `backend/app/services/signoff_service.py`, `backend/app/schemas/signoff.py`

**Frontend**
- `frontend/src/types/settings.ts`, `frontend/src/types/index.ts`
- `frontend/src/services/migrationSettings.ts`, `frontend/src/data/store.ts`
- `frontend/src/pages/MigrationSettingsPage.tsx`, `frontend/src/pages/ProjectDetailsPage.tsx`
- `frontend/src/pages/SettingsHome.tsx`, `frontend/src/App.tsx`
- `frontend/src/lib/milestones.ts`, `frontend/src/components/waves/WaveGanttChart.tsx`
- `docs/frontend/samples/milestone-import.sample.json`
- delete: `frontend/src/services/signoffConfig.ts`, `frontend/src/pages/SignoffSettingsPage.tsx`

## Reuse

- `frontend/src/lib/milestones.ts` — reference implementation for the Python port.
- `migration_settings_service` ConfigStore pattern — additive keys, no migration.
- `getMigrationSettings` call pattern already used per-request in
  `routers/projects.py:746/763`.
- `downloadImportSample` Blob-download pattern for the export.
- `useMigrationSettings` hook already in ProjectDetailsPage.
- `Switch`, `Input`, `Label` UI components already used in MigrationSettingsPage.

## Steps

- [x] Backend: settings schema + service (weights, signoff_enabled) with validation
- [x] Backend: remove `/settings/signoff` endpoint, service, schema; update MCP tool
- [x] Backend: port milestone stats to `milestone_stats.py`
- [x] Backend: rewrite `compute_stage_progress` + thread settings through call sites; fix eager loads
- [x] Backend: run pytest (56 passed + 10 new; 2 pre-existing category-milestone failures unrelated)
- [x] Frontend: types + service mapping + mock store; delete signoff page/route/nav/service
- [x] Frontend: MigrationSettingsPage — signoff switch, Jira gating, weights section + validation
- [x] Frontend: ProjectDetailsPage — signoffEnabled from migration settings
- [x] Frontend: milestone types + meta + presets + sample JSONs
- [x] Frontend: "Download milestone data" menu item + export handler
- [x] Verify end-to-end (below)

## Verification

- `cd backend && pytest` (add/adjust tests for `compute_stage_progress` weights
  and milestone stats port if a test harness for them exists).
- `cd frontend && npm run lint && npm run build`.
- Seed data + dev servers; manual checks:
  1. Change weights → HomePage project card %, Overall Progress %, Projects
     table %, and Gantt `%` column all reflect the new weights consistently.
  2. Mark project survey-not-required → its % rises (survey weight in setup).
  3. Disable sign-off → Sign-off stage disappears from stepper, Jira switch
     disabled + forced off after save; project % folds signoff into setup.
  4. Milestone status changes in Gantt → HomePage card migration contribution
     matches stepper migration % and Gantt `%` column.
  5. Add the two Big data presets via "Add milestone"; export a project's
     milestone data → re-import the file → no errors, milestones recreated.
