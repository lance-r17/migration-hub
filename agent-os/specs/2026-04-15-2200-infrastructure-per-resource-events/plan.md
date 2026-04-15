# Fix: Infrastructure Resource Changes → Per-Resource `resource_updated` Events

## Context

`_replace_resources()` emits one `section_updated` entry → renders as "Section updated". Frontend mock already does per-resource `resource_updated` events via `classifyResourceEvents()`. Backend must match.

## Task 1: Save spec documentation ✓

## Task 2: Replace `_diff_resources()` with `_classify_resource_changes()` in `project_service.py`

- New helper returns `(rid, entity_label, changes)` tuples grouped per resource
- `_replace_resources()` loops tuples and calls `append_entry(resource_updated)` per resource
- Removed: empty changes, entity_label = resource name
- Added: empty changes, entity_label = resource name
- Specs modified: `_diff_section()` changes

## Verification

1. No changes → no entries
2. Add/remove/edit resource → individual `resource_updated` entries, Server icon, resource name as title
3. "Resources" filter in Change History shows them correctly
