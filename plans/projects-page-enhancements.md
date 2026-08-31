# Projects Page Enhancements

## Context

`frontend/src/pages/ProjectsPage.tsx` renders a server-paginated table backed by `GET /api/v1/projects/table` (`backend/app/routers/projects.py` `_project_table_row` + `project_service.get_table_page`). Requested: (1) BGI Champion + BGI Champion Delegate columns left of ITSO; (2) filters by roles; (3) Migration Period aligned with the Gantt's derived project timeline; (4) export updated accordingly.

## Key findings

- **Role resolution pattern exists**: `_itso_name/_itso_delegate_name` (`routers/projects.py:68-93`) resolve names from `project_users` roles (`itso`, `itso_delegate`). BGI Champion columns follow the same pattern with `gbi_champion` / `gbi_champion_delegate` (`GBI_ROLES`, `project_service.py:94`). `project_users` are already selectinloaded in `get_table_page`.
- **Migration Period today**: backend `get_migration_period_days` (planning.startDate/endDate → constraints fallback) used for the `migration_range` filter; row payload trims planning to `{startDate, endDate}` (`_TABLE_PLANNING_KEYS`); frontend `getMigrationDates`/`getMigrationPeriodDays` (`lib/export-report.ts:807-828`) render the cell + export; mock mirror `mockMigrationPeriodDays` (`services/projects.ts:511`).
- **Gantt alignment target**: project dates = union of planning.milestones + env-provision dev/prod dates + data-migration plan/schedule (incl. cycleBlocks) + category milestone overrides/global dates; fallback constraints → wave dates.
- **Export**: `exportProjectsToExcel` (`export-report.ts:1198`) — flat column map; add 2 columns before ITSO.
- `ProjectTableRow` type (`types/index.ts`) and pydantic schema (`schemas/project.py`) both need the 2 new fields.

## Approach

- **BGI Champion columns**: backend `_governance_user_name(p, role)` helper (same `project_users` role-split pattern as `_itso_name`, `routers/projects.py:68-93`) for `gbi_champion` / `gbi_champion_delegate`; new fields on `ProjectTableRow` (pydantic + TS type); columns rendered left of ITSO; export columns 'BGI Champion' / 'BGI Champion Delegate' before 'ITSO'.
- **Role filter** (decision 1a): single role Select (ITSO / ITSO Delegate / BGI Champion / BGI Champion Delegate) + person Select (enabled once a role is chosen, users from `useUsers`); shows projects where that person holds that role. Backend params `role` + `role_user_id` on `/projects/table`; filter in `get_table_page` via `project_users` (user_id match + role in comma-split role list). Mock mirrors via `store` project-users map + user `projectRoles`.
- **Migration period alignment**: new `get_derived_project_dates(project)` in `project_service.py` mirroring the Gantt union — planning.milestones (excluding ids shadowed by assigned category milestones), env-provision dev/prod dates, data-migration plan/schedule (startDate/endDate + cycleBlocks), assigned category milestones (override dates else global CM dates); fallback constraints earliest/latest → wave startDate/cutoverDate. `get_table_page` gains `selectinload(Project.category_milestones)` + `selectinload(Project.wave)`; `get_migration_period_days` uses the union; `_project_table_row` writes the derived dates into the trimmed `planning` payload so the frontend cell and export (`getMigrationDates`) align automatically with no frontend calc change.

## Files to modify

- `backend/app/routers/projects.py` — `_governance_user_name`, `_project_table_row` (new fields + derived planning dates), `/table` endpoint params
- `backend/app/schemas/project.py` — `ProjectTableRow` += `gbi_champion`, `gbi_champion_delegate`
- `backend/app/services/project_service.py` — `get_derived_project_dates`, `get_migration_period_days` union, `get_table_page` loads + role filter
- `frontend/src/types/index.ts` — `ProjectTableRow` += gbiChampion/gbiChampionDelegate
- `frontend/src/services/projects.ts` — `ProjectsTableParams` += role/roleUserId, query params, mock period calc + mock role filter
- `frontend/src/hooks/use-projects-table.ts` — pass-through
- `frontend/src/pages/ProjectsPage.tsx` — 2 columns left of ITSO, role + person Selects
- `frontend/src/lib/export-report.ts` — 2 export columns before ITSO

## Steps

- [ ] 1. Backend: derived-dates union + migration period + table fields + role filter params
- [ ] 2. Frontend types + services/hooks plumbing (+ mock)
- [ ] 3. ProjectsPage: columns + role filter UI
- [ ] 4. Export columns

## Verification

- `cd backend && .venv/bin/python -m pytest tests/ -q` (no new failures); frontend `npm run build` diff vs baseline; eslint touched files
- Mock mode: champion columns populated; role+person filter narrows table & export; migration period matches Gantt bar for a project with milestones + env provision + category milestone; export has new columns
