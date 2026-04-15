# Survey API Casing Fix

## Problem

`GET /api/v1/settings/survey` returns snake_case top-level fields (`is_active`, `updated_by`, `updated_at`). The frontend `SurveyConfig` type expects camelCase. Result: `config.isActive` is `undefined` — the survey toggle shows as inactive and metadata fields are empty when running against the real API.

Same issue for `GET /api/v1/settings/resource-survey` → `ResourceSurveyConfig`.

## Solution

Add `fromApi`/`toApi` mapper functions in `frontend/src/services/surveyService.ts` — the established codebase pattern for this type of translation.

## Implemented

**`frontend/src/services/surveyService.ts`**

Added four private mappers:
- `surveyConfigFromApi(raw)` — maps `is_active`→`isActive`, `updated_by`→`updatedBy`, `updated_at`→`updatedAt`
- `surveyConfigToApi(config)` — reverses for POST
- `resourceSurveyConfigFromApi(raw)` — maps `updated_by`/`updated_at` for resource survey
- `resourceSurveyConfigToApi(config)` — reverses for POST

Wired into all four real-API call sites: `getSurveyConfig`, `saveSurveyConfig`, `getResourceSurveyConfig`, `saveResourceSurveyConfig`.
