# Resource Survey Questionnaire — Implementation Plan

See `/home/node/.claude/plans/sequential-snacking-hinton.md` for the full approved plan.

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/types/survey.ts` | Added `ResourceSurveyInputType`, `ResourceQuestionDef`, `ResourceQuestionLevel`, `ResourceQuestionGroup`, `ResourceSurveyConfig` |
| `frontend/src/data/mock.ts` | Added `redis` to productCategoryMap, redis resources to PRJ-2024-ALPHA, `mockResourceSurveyConfig` |
| `frontend/src/data/store.ts` | Added `_resourceSurveyConfig`, `getResourceSurveyConfig`, `setResourceSurveyConfig`, `batchUpdateResourceSpecs` |
| `frontend/src/services/surveyService.ts` | Added `getResourceSurveyConfig`, `saveResourceSurveyConfig`, `batchUpdateResourceSpecs` |
| `frontend/src/hooks/use-survey.ts` | Added `useResourceSurveyConfig` hook |
| `frontend/src/components/settings/SurveyBuilderSection.tsx` | Refactored into `ApplicationSurveyTab` + `ResourceQuestionsTab`, wrapped in `Tabs` |
| `frontend/src/components/survey/SurveyModal.tsx` | Added `ResourceStep` computation, `resourceAnswers` state, `ResourceQuestionInput`, resource step rendering, `batchUpdateResourceSpecs` in submit |
| `frontend/src/pages/ProjectDetailsPage.tsx` | Added `useResourceSurveyConfig`, `useProductCategoryMap`, passed props to `SurveyModal` |

## Completed: 2026-04-10
