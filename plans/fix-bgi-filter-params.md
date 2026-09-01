# Fix: BGI filter sends every descendant ID to `/projects/table`

## Context

On `ProjectsPage`, when a user selects a top-tier BGI node, the frontend expands the
selection into **every descendant node ID** (`selectedBgiDescendantIds` →
`collectAllIds`) and appends each as a repeated `bgi_ids` query param
(`frontend/src/services/projects.ts:644`). With a deep hierarchy this produces
hundreds/thousands of query params → URL exceeds server/proxy limits and
`GET /api/v1/projects/table` fails (414 / dropped request).

The frontend already keeps the selection in compact form: `selectedBgiIds`
(checked nodes) + `excludedBgiIds` (unchecked descendants). The backend already
has subtree expansion: `bgi_service.get_descendant_ids_for_multiple(db, ids)`
(used for `bgi_cloud_lead` role scoping). So we can ship the compact selection
and let the backend expand — the minimal-parameter fix.

## Approach

Change the `/projects/table` BGI filter contract from *"list of exact
`project.bgi_id` values"* to *"selected hierarchy nodes + excluded hierarchy
nodes, expanded server-side"*:

- Request: `bgi_ids=<id>` (repeatable, selected nodes) + new
  `excluded_bgi_ids=<id>` (repeatable, excluded nodes). Typically 1–3 params
  total instead of N descendants.
- Backend: `filter_ids = descendants(bgi_ids) − descendants(excluded_bgi_ids)`,
  then `Project.bgi_id.in_(filter_ids)` as today.
- `get_descendant_ids_for_multiple` falls back to the raw ID when the node is
  not in the stored hierarchy, so IDs that are not hierarchy nodes (e.g. tests
  with no seeded hierarchy) keep working — existing `test_bgi_filter` stays green.
- Empty result after subtraction (everything excluded) must mean **zero rows**,
  not "no filter" — so `get_table_page` switches from truthiness to `is not None`.

Frontend stops computing `selectedBgiDescendantIds`/`bgiIdList` entirely and
passes the compact sets. The selection UI (`BgiTree`, promote/prune logic) is
untouched.

## Files to modify

- `backend/app/routers/projects.py` — `list_projects_table`: add
  `excluded_bgi_ids: list[str] | None = Query(None)`; expand `bgi_ids` via
  `bgi_service.get_descendant_ids_for_multiple`, subtract excluded descendants,
  pass as `filter_bgi_ids`.
- `backend/app/services/project_service.py` — `get_table_page`: change
  `if filter_bgi_ids:` → `if filter_bgi_ids is not None:` (empty list = match nothing).
- `backend/tests/test_projects_table.py` — add tests with a seeded `ConfigStore`
  hierarchy: parent selection matches descendants; selection + exclusion
  subtracts the excluded subtree; full exclusion returns zero rows.
- `frontend/src/pages/ProjectsPage.tsx` — delete `selectedBgiDescendantIds` and
  `bgiIdList` memos; pass `bgiIds: selectedBgiIds.size ? [...selectedBgiIds] : null`
  and `excludedBgiIds: [...excludedBgiIds]` to `useProjectsTable` and
  `handleExport`'s `getProjectsTable`.
- `frontend/src/hooks/use-projects-table.ts` — add `excludedBgiIds` to params,
  request key, and `getProjectsTable` call.
- `frontend/src/services/projects.ts` — `ProjectsTableParams.excludedBgiIds?: string[] | null`;
  append `excluded_bgi_ids` query params. Mock path: apply both lists as exact
  matches (mock store has no hierarchy, so no expansion possible there).

## Reuse

- `backend/app/services/bgi_service.py` — `get_descendant_ids_for_multiple`
  (subtree expansion, dedup, fallback for unknown IDs).
- `backend/app/models/config_store.py` — `ConfigStore` key `bgi_hierarchy`
  (used to seed hierarchy in tests).
- Frontend `selectedBgiIds` / `excludedBgiIds` state already exists in
  `ProjectsPage.tsx`; no UI changes needed.

## Steps

- [ ] 1. Backend: expand `bgi_ids`, subtract `excluded_bgi_ids` in
      `list_projects_table`; `is not None` check in `get_table_page`.
- [ ] 2. Backend tests: seeded-hierarchy expansion, exclusion subtraction,
      full-exclusion → zero rows; run `pytest backend/tests/test_projects_table.py`.
- [ ] 3. Frontend: service + hook accept `excludedBgiIds`; `ProjectsPage` passes
      compact sets; remove expansion memos.
- [ ] 4. Frontend check: `tsc` / build passes; no orphaned imports in
      `ProjectsPage.tsx` (`collectAllIds`, `findNodeById` still used by the
      tree handlers — verify).

## Verification

1. `cd backend && pytest tests/test_projects_table.py` — all green, incl. new
   hierarchy-expansion/exclusion tests and pre-existing `test_bgi_filter`.
2. `cd frontend && npx tsc --noEmit` (or project lint/build) — clean.
3. Manual: run app, open Projects → BGI filter, select a top-tier node in a deep
   hierarchy → request to `/api/v1/projects/table` carries only the selected ID
   (inspect Network tab); results include all descendant projects. Exclude one
   child → its subtree disappears. Export with the same filter works too.
4. curl smoke test:
   `GET /api/v1/projects/table?page=1&page_size=20&bgi_ids=<top-tier-id>&excluded_bgi_ids=<child-id>`

## Assumptions

- `/projects/table` is only consumed by this frontend (per
  `plans/projects-table-backend-pagination.md`), so the `bgi_ids` semantic
  change (exact match → expand-to-descendants) is safe; frontend and backend
  deploy together.
- `excluded_bgi_ids` without `bgi_ids` is ignored (frontend invariant:
  exclusions only exist under a selection; `pruneEmptySelections` enforces it).
