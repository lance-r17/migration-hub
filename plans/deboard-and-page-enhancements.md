# Plan: Deboard Projects Handling + Wave Gantt & Data Migration Enhancements

## Context

Projects with `applicationOverview.migrationStrategy === 'Deboard'` (decommission candidates — no cloud migration happens for them) currently pollute the projects table, home-page progress metrics, and active-project lists. This plan:

1. **ProjectsPage** — "Show Deboard" switch (default OFF) filtering deboard projects out of the table.
2. **HomePage** — exclude deboard projects from overall progress % and the Active Projects section; retitle to "Active Projects ({n})" where n = **all non-deboard projects** (user confirmed option a); remove the "{n} total projects" row from the "View All Projects" card.
3. **New status** — deboard projects that passed the prepare stage get status **`no-migration-required`**, labeled **"No Migration Required"** (user confirmed), applied consistently on all pages.
4. **WaveGanttPage** — Engagement Manager multi-select filter immediately left of the "Advanced" filter (pattern from EngagementCalendarPage), platform-lead only.
5. **DataMigrationPage** — platform-lead-only "Remove from scope" button with confirmation dialog (destructive clear of plan + schedule — user confirmed first proposal), plus a search toolbar row between header and content (pattern from EnvironmentProvisionPage).

## Approach

### 1. ProjectsPage — "Show Deboard" switch (server-side filter; table is server-paginated)

- Backend `GET /api/v1/projects/table`: add query param `include_deboard: bool = False` → pass through to `project_service.get_table_page`; when false, skip projects where `(application_overview or {}).get("migrationStrategy") == "Deboard"` (null/absent strategy is kept).
- Frontend: add `includeDeboard?: boolean` to `ProjectsTableParams` in `frontend/src/services/projects.ts`; only append `include_deboard=true` to the query string when ON. Mirror in `mockGetProjectsTable` (mock mode).
- `useProjectsTable`: add `includeDeboard` to params + `requestKey` serialization.
- `ProjectsPage.tsx`: new `showDeboard` state (default `false`); a `Switch` + `Label` ("Show Deboard") in the filter row (Switch is already imported); toggling resets `currentPage` to 1; also passed to the export fetch in `handleExport` so export matches the table.

### 2. HomePage — exclude deboard projects

- Backend: the `/home` payload field sets do not include `application_overview`. Add a trimmed `application_overview` (only `migrationStrategy`) to the `"basic"` branch of `_project_home_item` (`backend/app/routers/projects.py:~350`) and add `application_overview: dict | None` to the `ProjectHomeItem` schema (`backend/app/schemas/project.py:128`). Frontend `fromApiListItem` already maps `application_overview` → `applicationOverview`.
- Backend `get_home_summary` (`project_service.py:655`): exclude deboard projects from both the top-5 active list and the `total` count. `total` then equals the non-deboard project count.
- `HomePage.tsx`:
  - Helper `isDeboard(p) => p.applicationOverview?.migrationStrategy === 'Deboard'`; filter it out inside `displayStats` (progress, totalAssets, completed, inProgress) and in `bgiFilteredSortedProjects` (drives charts and the non-platform-lead grid).
  - Title: `Active Projects ({gridTotal})` — platform lead: `homeSummary.total` (already non-deboard from backend); others: non-deboard filtered list length. Title only renders for leads (unchanged).
  - Remove the `<p>{gridTotal} total projects</p>` row from the "View All Projects" card.
- Mock: `getProjectsHomeSummary` mock in `services/projects.ts` filters deboard from `all`/`active` the same way.

### 3. New status `no-migration-required` ("No Migration Required")

Derived (not manually set), consistent with the existing status machinery:

- Backend `derive_status_from_stage_progress(stage_data, migration_strategy=None)` (`project_service.py:186`): if `migration_strategy == 'Deboard'` and `setup == 100` and `survey == 100` and `signoff == 100` → return `'no-migration-required'` (checked before the migration rules; when sign-off is disabled the progress context already reports `signoff = 100`, so the rule is uniform). Thread the strategy through callers: `_derive_and_store_status`, the unblock re-derivation, `_derive_status` in `routers/projects.py`, and `get_table_page`'s `effective_status`.
- `_matches_status_filter` (`project_service.py:546`): no change needed — default `effective_status == status_filter` equality matches the new value.
- Frontend `types/index.ts`: add `'no-migration-required'` to `ProjectStatus`.
- `StatusBadge.tsx`: add `statusConfig`/`statusVariant` entries (label **"No Migration Required"**, outline variant, muted styling distinct from Completed) + a `getStatusDetail` line (e.g. "Deboard strategy — no migration needed"). `getStatusLabel`, `ProjectCard`, `ProjectDetailsPage`, Gantt tooltips, and export reports all flow through these — consistent everywhere automatically.
- `ProjectsPage` status filter: add `<SelectItem value="no-migration-required">No Migration Required</SelectItem>` (note: matches only visible when "Show Deboard" is ON, since deboard projects are otherwise excluded).

### 4. WaveGanttPage — Engagement Manager filter (platform lead only)

- `WaveGanttPage.tsx`: add `'engagement'` to the `useProjects` fields; compute `engagementManagers` (id/name list derived from `p.engagement?.engagementManagerId` + `apiClient.get<User[]>('/api/v1/users')`, same as `EngagementCalendarPage.tsx:~195-212`) and pass to the chart **only when `isPlatformLead`** (pass `undefined`/empty otherwise → filter invisible).
- `WaveGanttChart.tsx`:
  - New prop `engagementManagers?: { id: string; name: string }[]`; state `selectedEngagementManagerIds: Set<string>`; `hasManagerFilter` + `matchingManagerIds` memo (project matches if its `engagement.engagementManagerId` ∈ selection).
  - UI: dropdown (User icon + "Manager" + count badge + "Clear filter"), copied from the calendar's Manager filter, placed **immediately left of the Advanced popover** in the controls bar with a separator; rendered only when `engagementManagers.length > 0`.
  - Integrate `(!hasManagerFilter || matchingManagerIds.has(p.id))` into the three filter chains (`rows` memo ~:1659, and the memos at ~:1735/:1749) and add `hasManagerFilter` to the "hide empty waves/unassigned" conditions.

### 5. DataMigrationPage

**Remove-from-scope button** (platform lead only):
- Backend: new endpoint `POST /api/v1/projects/{id}/data-migration-remove-from-scope` modeled on `data-migration-reopen` (`routers/projects.py:1265`): platform-lead/admin only; service fn `remove_from_data_migration_scope` sets `data_migration_plan = None` and `data_migration_schedule = None` and writes an audit entry (a dedicated endpoint is required because the section PATCH route rejects `dataMigrationPlan` updates once `completedAt` is set — `routers/projects.py:955`).
- Frontend `services/projects.ts`: `removeFromDataMigrationScope(id)` (+ mock impl clearing both keys on the store).
- `DataMigrationPage.tsx`: "Remove from scope" destructive-outline `Button` in the right-column header action group (visible for platform lead regardless of completion state). Confirmation `Dialog` shows: project name/ID, booked cycle block(s), cycle count, DTS instances, ASR-DR yes/no; impact bullets: plan **and** survey schedule permanently deleted, booked capacity freed in N cycle block(s), ASR-DR slot released (if applicable), project disappears from this page, action cannot be undone. On confirm: call service, clear `projectOverrides` entry / set both keys undefined, deselect the project, success toast.

**Search toolbar row** (pattern from `EnvironmentProvisionPage.tsx:~600`):
- Insert a `div.bg-background.shrink-0.flex.items-center.gap-2.px-3.h-11.border-b` between the header and the content grid, containing a Search `Input` ("Search projects..."); it filters the middle-column `filteredProjects` by name/id (case-insensitive).

## Files to modify

- `frontend/src/pages/ProjectsPage.tsx` — Show Deboard switch, status filter option
- `frontend/src/hooks/use-projects-table.ts` — `includeDeboard` pass-through
- `frontend/src/services/projects.ts` — `getProjectsTable` param, `removeFromDataMigrationScope`, mock updates
- `frontend/src/types/index.ts` — `ProjectStatus` union
- `frontend/src/components/shared/StatusBadge.tsx` — new status config
- `frontend/src/pages/HomePage.tsx` — deboard exclusions, title, card row removal
- `frontend/src/pages/WaveGanttPage.tsx` — engagement field + managers prop
- `frontend/src/components/waves/WaveGanttChart.tsx` — manager filter UI + filtering
- `frontend/src/pages/DataMigrationPage.tsx` — remove button + dialog, search toolbar row
- `backend/app/routers/projects.py` — `include_deboard` param, `migration_strategy` threading, home-item overview trim, new remove endpoint
- `backend/app/services/project_service.py` — `get_table_page` deboard filter, `derive_status_from_stage_progress` strategy param, `get_home_summary` exclusion, `remove_from_data_migration_scope`
- `backend/app/schemas/project.py` — `ProjectHomeItem.application_overview`

## Reuse

- `Switch` (`@/components/ui/switch`) — already imported in ProjectsPage; used in WaveGanttChart for "Show completed waves".
- Engagement Manager dropdown pattern — `EngagementCalendarPage.tsx:~440-510` (`availableEngagementManagers` memo at ~:195).
- Filter-bar toolbar row pattern — `EnvironmentProvisionPage.tsx:~600`.
- Confirmation dialog pattern — existing `Dialog` usage in DataMigrationPage (complete/reopen dialogs).
- Remove endpoint pattern — `mark_data_migration_reopen` route + service (`routers/projects.py:1265`).
- `derive_status_from_stage_progress` / `_matches_status_filter` / `StatusBadge` / `getStatusLabel` — existing status machinery.

## Steps

1. Backend: `derive_status_from_stage_progress` + callers get strategy; add tests → verify: `pytest backend/tests/test_projects_table.py`
2. Backend: `/table` `include_deboard` param + `get_table_page` filter → verify: tests + manual query
3. Backend: `get_home_summary` deboard exclusion; `_project_home_item` basic gets trimmed `application_overview`; `ProjectHomeItem` schema → verify: `pytest backend/tests/test_projects_home.py`
4. Backend: `data-migration-remove-from-scope` endpoint + service → verify: manual API call / test
5. Frontend: types + StatusBadge + ProjectsPage status filter option
6. Frontend: services + `useProjectsTable` + ProjectsPage Show Deboard switch (incl. export) → verify: table hides Deboard rows by default
7. Frontend: HomePage exclusions, title count, card row removal → verify: progress % and grid exclude deboard
8. Frontend: WaveGanttPage + WaveGanttChart manager filter → verify: platform lead sees filter left of Advanced; other roles don't
9. Frontend: DataMigrationPage remove-from-scope button + dialog + search toolbar row → verify: end-to-end in UI
10. Verify: `pnpm build` (tsc) + `pnpm lint`; run backend pytest suite

## Verification

- `cd backend && pytest tests/` — new/updated tests for table filter, status derivation, home summary, remove endpoint.
- `cd frontend && pnpm build && pnpm lint`.
- Manual (seed data contains many `Deboard` projects — `backend/scripts/seed_data/projects.json`):
  1. Projects page: switch OFF → no Deboard rows; ON → they appear; "No Migration Required" status filter works with switch ON; export respects the switch.
  2. Home: progress % changes vs. before; Active Projects title shows non-deboard count; grid has no deboard cards; "View All Projects" card has no count row.
  3. A Deboard project with setup/survey/sign-off complete shows "No Migration Required" badge on Projects table, Home cards, and Project details.
  4. Gantt: platform lead sees Manager filter left of Advanced, filtering works; non-lead roles don't see it.
  5. Data Migration: search row filters project list; platform lead can remove a project from scope after confirming the dialog (capacity freed, project gone from blocks); button hidden for other roles.
