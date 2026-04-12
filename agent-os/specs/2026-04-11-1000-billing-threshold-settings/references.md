# References for Billing Threshold Settings

## Similar Implementations

### EmbargoPage

- **Location:** `frontend/src/pages/EmbargoPage.tsx`
- **Relevance:** Settings sub-page layout: breadcrumb + icon + title + description pattern
- **Key patterns:** Breadcrumb navigation back to /settings, section heading style

### surveyService

- **Location:** `frontend/src/services/surveyService.ts`
- **Relevance:** Settings service layer pattern with mock/real toggle
- **Key patterns:** `USE_MOCK` branch, `delay()`, `apiClient.get/post`, store passthrough

### Mock Store (Billing section)

- **Location:** `frontend/src/data/store.ts` (lines 209–223)
- **Relevance:** In-memory mutable state pattern for billing data
- **Key patterns:** Module-level `let` variable, getter/setter methods on `store` object
