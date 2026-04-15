# Fix Audit Log Change Visibility — Shaping Notes

## Scope

Fix the audit log change history panel so that old → new value comparisons are visible when a project section is updated.

## Decisions

- Fix is backend-only: `project_service.py` is the single source of the bug
- Store field-level diffs (not whole-section objects) to match the frontend mock path behaviour
- Only append an audit entry when at least one field actually changed
- No frontend changes needed — `fromApi()`, `formatValue()`, and `AuditLogTimeline` are all correct

## Context

- **Visuals:** None provided — user shared raw API response showing the data shape
- **References:** `frontend/src/hooks/use-projects.ts` (mock path uses `diffObjects()` for field-level diffs)
- **Product alignment:** N/A

## Root Causes Found

1. **Casing mismatch:** Backend stored `{"oldValue": …, "newValue": …}` but `fromApi()` reads `c.old_value` / `c.new_value` → always `undefined` in frontend
2. **Section-level diff:** Even with casing fixed, entire section object stored as one entry → renders as truncated JSON blob

## Standards Applied

- Backend returns snake_case; frontend reads snake_case from API responses
