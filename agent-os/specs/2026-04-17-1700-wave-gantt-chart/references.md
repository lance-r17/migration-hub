# References for Wave Gantt Chart

## Similar Implementations

### WavePlanningModal + WavePlanningBoard

- **Location:** `frontend/src/components/waves/WavePlanningModal.tsx`, `WavePlanningBoard.tsx`
- **Relevance:** Modal shell pattern, Show Completed toggle, wave/project data flow
- **Key patterns:** Full-screen fixed overlay, header with icon+toggle+close, `filteredWaves` derived from `showCompleted`

### Jira custom field ID lookup (create_epic)

- **Location:** `backend/app/services/jira_client.py` lines 64-78
- **Relevance:** Pattern for fetching and caching "Target Start" / "Target End" custom field IDs
- **Key patterns:** GET `/rest/api/3/field`, name-based lookup, graceful fallback on failure

### ScheduleWindowsDrawer date picker

- **Location:** `frontend/src/components/drawers/ScheduleWindowsDrawer.tsx` lines 99-130
- **Relevance:** Pattern for date range input (earliestStartDate / latestEndDate)
- **Key patterns:** react-day-picker with dual date state
