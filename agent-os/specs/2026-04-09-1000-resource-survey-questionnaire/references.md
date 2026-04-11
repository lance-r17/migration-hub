# References for Resource Survey Questionnaire

## Similar Implementations

### Existing SurveyModal

- **Location:** `frontend/src/components/survey/SurveyModal.tsx`
- **Relevance:** Extended directly — resource steps appended after main app questions
- **Key patterns:** Step navigation with `currentIndex`, `Map<fieldId, AnswerValue>` for answers, `handleSubmit` groups by sectionKey and calls `onSave`

### Existing SurveyBuilderSection

- **Location:** `frontend/src/components/settings/SurveyBuilderSection.tsx`
- **Relevance:** Extended with a second tab ("Resource Questions") using `Tabs` from shadcn/ui
- **Key patterns:** `useSurveyConfig`, `useCurrentUser`, toast on save, Card-based question rows

### Survey service layer

- **Location:** `frontend/src/services/surveyService.ts`
- **Relevance:** New functions `getResourceSurveyConfig`, `saveResourceSurveyConfig`, `batchUpdateResourceSpecs` follow the same `USE_MOCK ? store.x() : apiClient.x()` pattern

### Mock store

- **Location:** `frontend/src/data/store.ts`
- **Relevance:** Added `_resourceSurveyConfig` in-memory store, `getResourceSurveyConfig`, `setResourceSurveyConfig`, `batchUpdateResourceSpecs` methods

### useProductCategoryMap hook

- **Location:** `frontend/src/hooks/use-product-category.ts`
- **Relevance:** Used to resolve `ResourceCategory` from `product` string when computing resource steps and applying category-scoped updates
