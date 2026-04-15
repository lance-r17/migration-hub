# Fix Resource Survey Audit Log — Shaping Notes

## Scope

When a resource survey is submitted, a `survey_submitted` audit log entry should appear in the project's change history with field-level changes per resource (e.g., "Server1 — Operating System: — → Linux RHEL 8").

Currently no entry is created in either mock or production mode.

## Decisions

- Event type: `survey_submitted` (already defined in `AuditEventType` and `AuditLogTimeline.tsx`)
- One audit entry per batch submission (not per resource)
- Changes: one item per spec field that actually changed, labeled `"<ResourceName> — <Field Label>"`
- No entry created if nothing changed
- Backend route needs actor threaded through to service (currently missing)
- Mock path uses placeholder actor (no real auth context available in service layer)

## Context

- **Visuals:** None
- **References:** `batch_update_resource_specs` in `project_service.py`; `_diff_section()` helper (already present from prior fix); mock pattern in `surveyService.ts`
- **Product alignment:** N/A

## Standards Applied

- Backend returns snake_case (`old_value`/`new_value`) — already enforced by `_diff_section()`
- Audit entry only created when `changes.length > 0`
