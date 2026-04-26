# References for Migration Effort Estimation

## Similar Implementations

### 1. JSONB Section Update Pattern
- **Location:** `backend/app/services/project_service.py`
- **Relevance:** `SECTION_COLUMN_MAP` and `update_section()` handle generic JSONB section updates, diffing, and audit logging.
- **Key patterns:** Add `"migrationEffortEstimation": "migration_effort_estimation"` to `SECTION_COLUMN_MAP` and `"migrationEffortEstimation": "Migration Effort Estimation"` to `SECTION_LABELS`.

### 2. Section UI Component Pattern
- **Location:** `frontend/src/components/project/TargetArchitectureSection.tsx`
- **Relevance:** Simple project section with view/edit states, card layout, and `onSave` callback.
- **Key patterns:** Card with header, conditional edit mode, textarea/inputs, save/cancel buttons.

### 3. Survey Field Definitions
- **Location:** `frontend/src/data/surveyFields.ts` and `backend/app/data/survey_field_defs.py`
- **Relevance:** Static definitions that map survey questions to project section fields.
- **Key patterns:** `id`, `sectionKey`, `fieldPath`, `inputType`, `defaultQuestion`, `defaultHint` must match exactly between frontend and backend.

### 4. Gantt Left Panel Rendering
- **Location:** `frontend/src/components/waves/WaveGanttChart.tsx` (lines ~905, ~1550–1650)
- **Relevance:** Left panel uses a CSS grid (`LP_GRID`) to render project/task rows.
- **Key patterns:** Update `LEFT_PANEL_W`, `LP_GRID`, header row, project row, task row, and ghost rows consistently.

### 5. File Upload Endpoint
- **Location:** `backend/app/routers/billing.py` (`upload_billing_xlsx`) and `frontend/src/services/billing.ts` (`uploadBillingXlsx`)
- **Relevance:** Pattern for handling multipart file uploads in FastAPI and calling them from the frontend.
- **Key patterns:** `UploadFile`, `Form` fields, `apiClient.postForm`, `FormData` with `file`.

### 6. Billing Config / Currency
- **Location:** `backend/app/schemas/billing.py` (`BillingThresholdConfigOut`) and `frontend/src/services/billingConfig.ts`
- **Relevance:** Source of truth for org-wide currency.
- **Key patterns:** Backend stores in `ConfigStore` under `billing_threshold_config`. Frontend fetches via `/api/v1/settings/billing-thresholds`.
