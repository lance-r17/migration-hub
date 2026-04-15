# Fix: currentInfrastructure Section — Empty Changes in Audit Log

## Context

PATCH `/sections/currentInfrastructure` creates a `section_updated` entry with `changes: []` because `_replace_resources()` hardcodes an empty list after the delete-reinsert cycle. Fix: snapshot old resources before deletion, diff against incoming data.

## Task 1: Save spec documentation ✓

## Task 2: Add `_diff_resources()` + fix `_replace_resources()`

**File:** `backend/app/services/project_service.py`

- Add `_diff_resources(old_list, new_list)` alongside `_diff_section()`
- Snapshot `old_resources` before deletion in `_replace_resources()`
- Only call `append_entry()` when `changes` is non-empty

## Verification

1. Save infrastructure unchanged → no entry
2. Add resource → `"{name} — Added"`
3. Remove resource → `"{name} — Removed"`
4. Change specs → `"{name} — {Field}": old → new`
