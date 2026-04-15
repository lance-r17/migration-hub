# Fix: Survey Field Defs Sync (data__lastRestoreTest unrenderable)

## Context

`data__lastRestoreTest` appears in `survey_config.json` (order 3) and in the frontend's `SURVEY_FIELD_DEFS` (`surveyFields.ts`), but the backend's `survey_field_defs.py` was missing it — and broadly used different ID prefixes (`datapersistence__*`, `migconstraints__*`, `targetarch__*`, `dependencies__*`) vs the frontend (`data__*`, `constraints__*`, `target__*`, `deps__*`).

When running against the real backend (`USE_MOCK = false`), `getSurveyFieldDefs()` fetched from `/api/survey/field-defs` which returned the backend's stale defs. `getFieldById('data__lastRestoreTest')` returned `undefined`, and `SurveyModal.tsx:178` silently rendered nothing (`if (!def) return null`).

## Changes Made

### Task 1: `frontend/src/services/surveyService.ts`

`getSurveyFieldDefs()` now always returns local `SURVEY_FIELD_DEFS` — no backend API call, no `USE_MOCK` branch.

### Task 2: `backend/app/data/survey_field_defs.py`

Fully rewritten to match all 36 fields from `surveyFields.ts` with correct IDs, sectionKeys, fieldPaths, inputTypes, and options.

## Verification

1. With backend running, open the Survey modal for any project
2. Step 3 (`data__lastRestoreTest`) renders a short-text input — "Last Restore Test"
3. Step 6 (`constraints__maintenanceWindow`) renders the `MigrationWindowPicker`
4. All 6 questions display correctly
5. Mock mode unchanged
