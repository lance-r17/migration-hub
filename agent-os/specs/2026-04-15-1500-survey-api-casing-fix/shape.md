# Survey API Casing Fix — Shaping Notes

## Scope

Fix the snake_case / camelCase mismatch between the survey settings API response and the frontend TypeScript types. The API returns `is_active`, `updated_by`, `updated_at` (snake_case) but the frontend expects `isActive`, `updatedBy`, `updatedAt` (camelCase). Affects both `SurveyConfig` and `ResourceSurveyConfig`.

## Decisions

- Fix in the frontend service layer (`surveyService.ts`) via `fromApi`/`toApi` mapper functions — consistent with the same pattern already applied to embargos, projects, billing, and billingConfig.
- Do not change the Pydantic backend schema — backend snake_case serialization is the expected contract.
- Question-level fields (`fieldId`, `questionText`, `hintText`) are already camelCase in both the seed JSON and the API response — no conversion needed there.

## Context

- **Visuals:** None
- **References:** `frontend/src/services/embargos.ts`, `frontend/src/services/billing.ts` — same fromApi/toApi pattern
- **Product alignment:** N/A

## Standards Applied

- Frontend service layer is responsible for API shape translation (established codebase pattern)
