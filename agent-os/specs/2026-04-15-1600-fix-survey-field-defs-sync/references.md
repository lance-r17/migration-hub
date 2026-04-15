# References for Fix Survey Field Defs Sync

## Similar Implementations

### Frontend field definitions (source of truth)

- **Location:** `frontend/src/data/surveyFields.ts`
- **Relevance:** The authoritative list of all 36 survey field definitions with correct IDs, sectionKeys, inputTypes, and options
- **Key patterns:** IDs use `section__fieldName` format with short prefixes (`data__`, `constraints__`, `target__`, `deps__`, `appoverview__`, `availability__`, `nfrs__`)

### Survey service mock/API toggle

- **Location:** `frontend/src/services/surveyService.ts`
- **Relevance:** Shows the `USE_MOCK = !BASE_URL` pattern — other service functions still branch on `USE_MOCK`; `getSurveyFieldDefs` no longer does
- **Key patterns:** `USE_MOCK` toggle controls real vs mock data; field defs are now always local since they're static compile-time data

### SurveyModal rendering gate

- **Location:** `frontend/src/components/survey/SurveyModal.tsx:178`
- **Relevance:** `if (!def) return null` — silently drops any question whose `fieldId` doesn't resolve via `getFieldById()`
- **Key patterns:** `useSurveyFieldDefs()` hook provides `getFieldById`; async load means defs may be empty on first render (handled by `loading` state in hook)
