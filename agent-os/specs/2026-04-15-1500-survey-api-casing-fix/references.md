# References for Survey API Casing Fix

## Similar Implementations

### Embargos service

- **Location:** `frontend/src/services/embargos.ts`
- **Relevance:** Same fromApi/toApi mapper pattern for snake_case ↔ camelCase
- **Key patterns:** `embargoFromApi()` maps `start_date`→`startDate`, `end_date`→`endDate`; `embargoToApi()` reverses

### Billing service

- **Location:** `frontend/src/services/billing.ts`
- **Relevance:** Same pattern; billing records use snake_case from backend
- **Key patterns:** `fromApi` mapper applied to each record in array responses

### Backend survey schema

- **Location:** `backend/app/schemas/survey.py`
- **Relevance:** Confirms `SurveyConfigOut` uses snake_case Pydantic fields (`is_active`, `updated_by`, `updated_at`)

### Frontend survey types

- **Location:** `frontend/src/types/survey.ts`
- **Relevance:** Confirms expected camelCase shape: `SurveyConfig.isActive`, `updatedBy`, `updatedAt`; `ResourceSurveyConfig.updatedBy`, `updatedAt`
