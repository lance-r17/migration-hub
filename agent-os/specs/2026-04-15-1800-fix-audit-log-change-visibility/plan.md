# Fix: Audit Log Change History Values Not Visible

## Context

Section update events appear in the audit log timeline but the old/new value comparison is always blank. Users cannot see what changed.

**Root cause — two bugs in `project_service.py`:**

1. Changes stored with camelCase keys (`oldValue`, `newValue`) but `fromApi()` in `auditLog.ts` reads snake_case (`old_value`, `new_value`) → values are always `undefined` in the frontend
2. Entire section object stored as one change entry → even with casing fixed, renders as truncated JSON blob

## Task 1: Save spec documentation ✓

Spec saved to `agent-os/specs/2026-04-15-1800-fix-audit-log-change-visibility/`

## Task 2: Fix `project_service.py`

**File:** `backend/app/services/project_service.py`

Changes:
1. Add `import re` at top
2. Add `_to_label()` + `_diff_section()` helpers before `_project_options()`
3. Fix `update()` line 103: `"oldValue"` → `"old_value"`, `"newValue"` → `"new_value"`
4. Fix `update_section()` lines 139–150: use `_diff_section()`, only log if changes exist

## Verification

1. Edit a section field and save → audit log shows field-level old → new
2. Save without changes → no new audit entry
3. Edit multiple fields → each appears as a separate change line
