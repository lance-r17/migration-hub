# Fix: Resource Survey Audit Log — No Changes Recorded

## Context

`batch_update_resource_specs()` updates resource specs but never calls audit logging. The `survey_submitted` event type is defined but never triggered. Backend route also lacks actor.

## Task 1: Save spec documentation ✓

## Task 2: Backend — thread actor + add audit logging

- `backend/app/routers/projects.py`: add `actor = await _get_actor(db)` and pass to service
- `backend/app/services/project_service.py`: add `actor` param, capture old specs, call `_diff_section()` per resource, call `append_entry(survey_submitted)` if changes exist

## Task 3: Frontend mock — add audit entry

- `frontend/src/services/surveyService.ts`: before `store.batchUpdateResourceSpecs()`, capture old specs; after, compute diffs via `diffObjects()`; call `appendAuditEntryMock()` with `survey_submitted` event if changes exist

## Verification

1. Submit survey in production → audit log shows `survey_submitted` with field-level changes
2. Submit survey in mock UI → Change History shows entry with `"ResourceName — Field"` labels
3. Submit without changes → no entry created
