# References for Fix Resource Survey Audit Log

## Similar Implementations

### `_diff_section()` helper

- **Location:** `backend/app/services/project_service.py` (added 2026-04-15)
- **Relevance:** Field-level dict diff, returns `{"field", "label", "old_value", "new_value"}` list — reused per-resource in this fix
- **Key patterns:** Returns `[]` when nothing changed; labels auto-derived from camelCase keys

### Section update audit pattern

- **Location:** `backend/app/services/project_service.py::update_section()` lines 160–174
- **Relevance:** Pattern for calling `audit_service.append_entry()` with `section_key`, `section_label`, and computed `changes`

### `_get_actor()` in route handlers

- **Location:** `backend/app/routers/projects.py` line 23
- **Relevance:** How to resolve actor from DB in a route handler — used in `update()` and `update_section()` routes; now also needed in `batch_update_resource_specs`

### `appendAuditEntryMock` + `diffObjects` mock pattern

- **Location:** `frontend/src/hooks/use-projects.ts` lines 412–421
- **Relevance:** Pattern for computing changes client-side and appending a mock audit entry after a store mutation
