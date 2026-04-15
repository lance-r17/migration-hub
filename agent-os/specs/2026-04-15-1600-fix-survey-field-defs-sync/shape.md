# Fix Survey Field Defs Sync — Shaping Notes

## Scope

Bug fix: `data__lastRestoreTest` (and several other fields) could not render their input in `SurveyModal.tsx` when running against the real backend. Root cause was a mismatch between the backend's `survey_field_defs.py` (different ID prefixes, missing fields) and the frontend's `surveyFields.ts` (source of truth).

## Decisions

- Frontend `SURVEY_FIELD_DEFS` from `surveyFields.ts` is the single source of truth for field definitions
- `getSurveyFieldDefs()` in `surveyService.ts` now always returns local data — no backend API call
- Backend `survey_field_defs.py` rewritten to match all 36 frontend field IDs exactly (for backend API correctness and future consumers)

## Context

- **Visuals:** None
- **References:** `frontend/src/data/surveyFields.ts`, `frontend/src/services/surveyService.ts`, `backend/app/data/survey_field_defs.py`
- **Product alignment:** N/A — pure bug fix

## Root Cause

`USE_MOCK = !BASE_URL`. In backend mode, `getSurveyFieldDefs()` called `/api/v1/settings/survey/field-defs`, returning stale Python defs with wrong IDs. `getFieldById('data__lastRestoreTest')` returned `undefined`. `SurveyModal.tsx:178` (`if (!def) return null`) silently dropped the question.
