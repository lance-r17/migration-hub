# References for Migration Effort Estimation Table

## Similar Implementations

### MigrationEffortEstimationSection
- **Location:** `frontend/src/components/project/MigrationEffortEstimationSection.tsx`
- **Relevance:** Existing section to be enhanced. Shows card + drawer pattern, attachment handling, currency display.
- **Key patterns:** SectionCard, SectionEditDrawer, file upload/delete

### SurveyModal — EffortEstimateSurveyInput
- **Location:** `frontend/src/components/survey/SurveyModal.tsx` (lines 354–455)
- **Relevance:** Existing combined effort estimate + notes slide. To be replaced with effort_table input.
- **Key patterns:** Custom survey input component, pre-fill from project data, combined slide logic

### DependencyListEditor
- **Location:** `frontend/src/components/survey/SurveyModal.tsx` (lines 119–164)
- **Relevance:** Pattern for inline-editable list of complex objects in survey modal.
- **Key patterns:** Array state, add/remove entries, per-item field editing

### CloudResourcesSection
- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx`
- **Relevance:** Table display pattern (raw `<table>` with columns).
- **Key patterns:** Table rendering, pagination, row actions

### ApplicationSurveyTab
- **Location:** `frontend/src/components/settings/survey-builder/ApplicationSurveyTab.tsx`
- **Relevance:** Survey builder field picker. Special handling for effort fields as a group.
- **Key patterns:** Field grouping, drag-and-drop, combined field handling

### Backend Survey Field Defs
- **Location:** `backend/app/data/survey_field_defs.py`
- **Relevance:** Must stay in sync with frontend surveyFields.ts
- **Key patterns:** Static list, inputType mapping
