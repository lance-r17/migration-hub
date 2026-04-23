# References for Project Field Updates

## Patterns Followed

### Field label map
- **Location:** `frontend/src/hooks/use-projects.ts` — `FIELD_LABEL_MAPS`
- **Relevance:** Authoritative label mapping used for audit log display

### Survey field definitions
- **Location:** `frontend/src/data/surveyFields.ts` — `SURVEY_FIELD_DEFS`
- **Location:** `backend/app/data/survey_field_defs.py` — `SURVEY_FIELD_DEFS`
- **Relevance:** Both must stay in sync; IDs, fieldPaths, labels, hints

### Section display components
- **Location:** `frontend/src/components/project/` — per-section TSX files
- **Relevance:** Each section has a display component that reads typed section data

### Section drawer components
- **Location:** `frontend/src/components/drawers/` — per-section drawer files
- **Relevance:** Each section has an edit drawer managing local draft state
