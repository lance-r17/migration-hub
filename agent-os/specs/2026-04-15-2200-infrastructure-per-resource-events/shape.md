# Infrastructure Per-Resource Events — Shaping Notes

## Scope

Change `_replace_resources()` to emit per-resource `resource_updated` audit entries instead of one bundled `section_updated` entry, so infrastructure changes render with the Server icon and resource name as title — consistent with mock mode behavior.

## Decisions

- Backend only: `project_service.py`
- Replace `_diff_resources()` (flat list) with `_classify_resource_changes()` (grouped by resource)
- Removed/Added resources: empty changes list (entityLabel is sufficient)
- Specs changes: `_diff_section()` output
- Mock mode already correct via `classifyResourceEvents()` in `use-projects.ts`
