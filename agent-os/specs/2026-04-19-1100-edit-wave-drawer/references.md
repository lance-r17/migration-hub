# References for Edit Wave Drawer

## Similar Implementations

### CreateWaveDrawer

- **Location:** `frontend/src/components/drawers/CreateWaveDrawer.tsx`
- **Relevance:** Color picker pattern (WAVE_COLORS swatch grid with ring indicator), Sheet/drawer layout
- **Key patterns:** `size-7 rounded-full` buttons with `ring-2 ring-offset-2 ring-foreground` when selected

### liveProjects pattern in WavesPage

- **Location:** `frontend/src/pages/WavesPage.tsx`
- **Relevance:** Optimistic local state override on top of hook data; same pattern used for `liveWaves`

### import_from_jira in wave_service.py

- **Location:** `backend/app/services/wave_service.py`
- **Relevance:** Pattern for calling jira_client.get_epic() and mapping fields onto a Wave model

### get_epic in jira_client.py

- **Location:** `backend/app/services/jira_client.py`
- **Relevance:** Extended to return `jira_status_category` from `fields.status.statusCategory.name`
