# Projects Page — Backend Pagination & Lean Table API

## Context

`ProjectsPage.tsx` currently loads **all** projects with heavy field groups (`basic, itso, itso_delegate, progress, planning, overview, effort, resources, dependencies`) via `useProjects` → `GET /api/v1/projects`, then filters and paginates entirely client-side. Problems:

1. **Payload size**: every row carries full `cloud_resources` (with specs), `approvals`, `dependencies`, etc. — only a fraction is rendered in the 20 table columns.
2. **Client-side filtering/pagination**: the full dataset is transferred and re-filtered on every keystroke.
3. **Export** (`exportProjectsToExcel`) can only export what's already in memory.

Goal: a dedicated table API with backend pagination + filtering, a lean row payload containing only what the table renders, a frontend refactor to match, and an export that asynchronously pulls the full filtered dataset from the backend and generates the Excel client-side.

## Decisions (confirmed with user)

- **Scores server-side**: port `getInfraFootprintScore` / `getMigrationDriverScore` (`frontend/src/lib/scoring.ts`) to Python; ship only the small precomputed result objects. Tooltips consume the results directly.
- **Filtering strategy**: SQL for role scoping / search / BGI; Python for derived statuses + migration-range (they depend on computed stage progress and JSONB dates); paginate the filtered result in Python. Response is always a single page.
- **Export**: same endpoint, unpaginated (`page_size=0` → all matching rows), Excel generated client-side as today.
- **Role scoping server-side**: backend scopes by `current_user` (admin / platform lead → all; BGI cloud lead → descendant BGI restriction (existing pattern); others → projects they are a member of via `ProjectUser`). Replaces the frontend `getProjects` vs `getProjectsForUser` split **for this endpoint only**.

## Current state (verified)

- Frontend load: `frontend/src/hooks/use-projects.ts` → `getProjects(fields)` in `frontend/src/services/projects.ts`.
- Backend list: `GET /api/v1/projects` (`backend/app/routers/projects.py`) → `project_service.get_all()` with `selectinload` rels.
- Filters to move backend:
  - `status`: plain statuses + derived (`awaiting-survey`, `drafting-survey`, `survey-submitted`, `awaiting-signoff`) computed from `compute_stage_progress` (needs `cloud_resources`, `approvals`, `project_users`, `survey_submitted_at`) + survey-draft project IDs (`project_service.get_survey_draft_project_ids` — reusable).
  - `search`: matches `name`, `id`, `application_overview->>'applicationName'`, `application_overview->>'baId'`.
  - `migration_range` (`lt30/30to90/90to180/gte180`): days between `planning.startDate/endDate` (fallback `migration_constraints.earliestStartDate/latestEndDate`).
  - `bgi_ids`: frontend already resolves selected/excluded tree nodes into an effective descendant-id set (`selectedBgiDescendantIds` in ProjectsPage) — sent as-is.
- Scoring: `frontend/src/lib/scoring.ts`; product→category map mirrors `backend/app/services/product_category_service.py` (`get_category_for_product` — reusable). Scoring reference cases exist in `frontend/scripts/verify-scoring.ts`.
- `StatusBadge` needs `status`, `stageProgress`, `hasSurveyDraft`, `surveySubmittedAt` — all shippable in the lean row (drops the separate `getSurveyDraftProjectIds()` call).
- Effort tooltip renders the full per-task breakdown → `migration_effort_estimation` ships **in full** in the lean row.

## Approach

### 1. Backend — scoring port

New `backend/app/services/scoring_service.py` — faithful Python port of `scoring.ts`:
- `get_infra_footprint_score(cloud_resources) -> dict` using `product_category_service.get_category_for_product`; returns `{score, ecs_count, ecs_level, data_volume_tb, data_volume_level, maxcompute_count, maxcompute_level}`.
- `get_migration_driver_score(application_overview, migration_effort_estimation, dependencies) -> dict`; returns `{score, tier_level, application_tier, iita_applicability, third_party_effort, third_party_level, dependency_count, dependency_level, external_user_count, external_user_level, internal_user_count, internal_user_level, app_count, app_level}`.
- Port `parseFirstNumber` (K/M/B suffixes) and `parseTbFromSpecs` exactly.

### 2. Backend — table endpoint

`GET /api/v1/projects/table` in `backend/app/routers/projects.py`:
- Query params: `page` (default 1), `page_size` (default 20; `0` = unpaginated, for export), `status`, `search`, `migration_range`, `bgi_ids` (repeatable).
- Role scoping from `current_user` as described above (reuse `_user_has_*` helpers + `bgi_service.get_descendant_ids_for_multiple`).

New `project_service.get_table_page(session, current_user, filters) -> (rows, total)`:
1. Base query: `select(Project)` + `selectinload(cloud_resources, approvals, project_users→user)` only (needed for stage progress, ITSO names, infra footprint).
2. SQL filters: role scoping; `bgi_id.in_(bgi_ids)`; search `ilike` OR-ed across `name`, `id`, `application_overview->>'applicationName'`, `application_overview->>'baId'`.
3. Fetch candidates (`order_by(Project.name)`); fetch draft project ids once via existing `get_survey_draft_project_ids`.
4. Per project: `compute_stage_progress`, effective status (`blocked` else `derive_status_from_stage_progress`), apply status filter (derived-status predicates mirror the current frontend logic exactly) and migration-range filter (dates from `planning` / `migration_constraints` JSONB).
5. `total = len(filtered)`; slice page; build lean rows incl. `has_survey_draft`, trimmed `application_overview` (`newProjectId, applicationName, baId, systemImportanceClassification, iitaApplicability, migrationStrategy`), trimmed `planning` (`startDate, endDate`), trimmed `migration_constraints` (`earliestStartDate, latestEndDate`), full `migration_effort_estimation`, and both precomputed score dicts.

New schemas in `backend/app/schemas/project.py`: `ProjectTableRow` (+ nested trimmed-overview/planning/constraints and score models) and `ProjectTablePage { items, total, page, page_size }`.

### 3. Frontend — service + hook

- `frontend/src/types/`: new `ProjectTableRow` type; score fields reuse the exported `InfraFootprintResult` / `MigrationDriverResult` interfaces from `lib/scoring.ts`.
- `frontend/src/services/projects.ts`: `getProjectsTable(params): Promise<{ items: ProjectTableRow[]; total: number }>` building the query string; mapper snake_case → camelCase (existing style).
- New `frontend/src/hooks/use-projects-table.ts`: `useProjectsTable({ page, pageSize, status, search, migrationRange, bgiIds })` → `{ rows, total, loading, error, refresh }`; debounces `search` (~300 ms); refetches on param change; cancels stale requests.

### 4. Frontend — ProjectsPage refactor

- Replace `useProjects(...)` with `useProjectsTable(...)`; delete `filteredProjects` / `paginatedProjects` memos and the `getSurveyDraftProjectIds` effect (row carries `hasSurveyDraft`).
- Filter controls unchanged; each change resets `currentPage` (existing behavior) and triggers a refetch via hook params.
- Pass `Array.from(selectedBgiDescendantIds)` as `bgiIds`.
- Pagination footer driven by `total` from the API.
- `StatusBadge`, `ProgressBar`, effort tooltip read from the lean row (effort tables are full).
- Dialogs (`mappingDialogProject`, `surveyNeedDialogProject`) switch from `Project` to `ProjectTableRow` (all needed fields present); on save call `refresh()`.
- `InfraFootprintTooltip` / `MigrationDriverTooltip`: change props from `project: Project` to `result: InfraFootprintResult` / `MigrationDriverResult`; update usage in ProjectsPage. (scoring.ts stays — still used by `verify-scoring.ts`; update `docs/frontend/components.md` props table.)

### 5. Frontend — export refactor

- Export button becomes async: `getProjectsTable({ ...currentFilters, pageSize: 0 })` → `exportProjectsToExcel(rows, bgiRoot)`; loading/success toasts already in the export util.
- `exportProjectsToExcel(projects, draftProjectIds, bgiRoot)` → `exportProjectsToExcel(rows: ProjectTableRow[], bgiRoot?)`: use `row.hasSurveyDraft` instead of `draftProjectIds`, and `row.infraFootprint.score` / `row.migrationDriver.score` instead of calling scoring functions. Column set unchanged.
- `getMigrationDates` / `getMigrationPeriodDays` / `getMigrationEffortSummary` get lean-row-compatible overloads or duplicated minimal helpers (they only need planning/constraints/effort fields present on the row).
- Other export functions in `export-report.ts` are untouched (they use `getProjects`, which stays).

## Files to modify

- `backend/app/services/scoring_service.py` — **new**, port of scoring.ts.
- `backend/app/services/project_service.py` — `get_table_page()`.
- `backend/app/routers/projects.py` — `GET /projects/table` route.
- `backend/app/schemas/project.py` — `ProjectTableRow`, `ProjectTablePage`.
- `backend/tests/` — scoring parity tests (port cases from `frontend/scripts/verify-scoring.ts`) + endpoint filter/pagination tests.
- `frontend/src/types/index.ts` (or new file) — `ProjectTableRow`.
- `frontend/src/services/projects.ts` — `getProjectsTable`.
- `frontend/src/hooks/use-projects-table.ts` — **new** hook.
- `frontend/src/pages/ProjectsPage.tsx` — rewire to backend pagination/filtering.
- `frontend/src/lib/export-report.ts` — `exportProjectsToExcel` lean-row version + async fetch in page.
- `frontend/src/components/project/InfraFootprintTooltip.tsx`, `MigrationDriverTooltip.tsx` — accept result objects.
- `docs/frontend/components.md` — tooltip props update.

## Reuse

- `project_service.compute_stage_progress`, `derive_status_from_stage_progress`, `get_survey_draft_project_ids` (`backend/app/services/project_service.py`).
- `product_category_service.get_category_for_product` (`backend/app/services/product_category_service.py`).
- `_user_has_admin_role` / `_user_has_platform_lead_role` / `_user_has_bgi_cloud_lead_role`, `bgi_service.get_descendant_ids_for_multiple` (existing role-scoping pattern in `routers/projects.py`).
- `_itso_name` / `_itso_delegate_name` helpers in `routers/projects.py`.
- Frontend: `InfraFootprintResult` / `MigrationDriverResult` types, `getStatusLabel`, `formatDate`, BGI tree utilities (`filterBgiTree`, `findNodeById`, `collectAllIds`, etc.) — all unchanged.

## Steps

- [x] 1. Port scoring to `backend/app/services/scoring_service.py`; add pytest parity tests from `verify-scoring.ts` cases. *(Note: `verify-scoring.ts` is stale — empty prod resources expectation was deliberately changed to `'Lightweight'` in commit 8798898; the port mirrors current `scoring.ts` behavior.)*
- [x] 2. Add `ProjectTableRow` / `ProjectTablePage` schemas; implement `project_service.get_table_page()`; add `GET /projects/table` route with role scoping + filters.
- [x] 3. Backend tests: filters (status incl. derived, search, migration range, bgi), pagination totals, role scoping. *(23 new tests passing; 2 `test_category_milestones.py` failures are pre-existing on main.)*
- [x] 4. Frontend: `ProjectTableRow` type + `getProjectsTable` service (incl. mock fallback) + `useProjectsTable` hook (debounced search, loading derived from request key).
- [x] 5. Refactor `ProjectsPage.tsx` to the hook; remove client filtering/pagination + draft-ids effect; rewire dialogs to `refresh()`.
- [x] 6. Change tooltip components to accept score results; update `docs/frontend/components.md`.
- [x] 7. Refactor `exportProjectsToExcel` to lean rows; export button fetches all filtered rows (`pageSize: 0`) then generates Excel. *(Added `data_migration_survey_submitted_at` to the lean row since the export needs it.)*
- [x] 8. Typecheck/build frontend; run backend test suite. *(No new tsc/eslint errors; build was already broken on main with unrelated pre-existing errors.)*

## Verification

- `cd backend && .venv/bin/pytest` — new + existing tests pass; scoring parity tests match `frontend/scripts/verify-scoring.ts` expectations.
- Manual curl: `/api/v1/projects/table?page=1&page_size=20&status=awaiting-survey&search=...&migration_range=lt30&bgi_ids=...` — verify items/total and lean payload size vs old endpoint.
- Frontend `pnpm build` (tsc) clean; manual UI pass: initial load shows skeletons then page 1; each filter + debounced search triggers one request and resets to page 1; pagination footer totals correct; tooltips (effort/infra/driver) render; both dialogs save and refresh the row; Export downloads Excel matching the active filters.
