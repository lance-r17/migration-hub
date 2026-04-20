# Edit Wave Drawer — Implementation Plan

## Tasks

### Task 1: Save spec documentation ✅
Created `agent-os/specs/2026-04-19-1100-edit-wave-drawer/` with plan.md, shape.md, references.md.

### Task 2: Backend — sync endpoint ✅
- `jira_client.py`: Added `jira_status_category` to `get_epic()` return dict
- `wave_service.py`: Added `sync_from_jira(session, wave_id)` — fetches epic, maps dates + status category → wave status
- `waves.py`: Added `POST /{wave_id}/sync` route

### Task 3: Frontend service ✅
- `waves.ts`: Added `updateWave(id, { color })` and `syncWaveFromJira(id)` with mock support

### Task 4: EditWaveDrawer component ✅
- `frontend/src/components/drawers/EditWaveDrawer.tsx` — new component with color picker + sync section

### Task 5: Wire into WavesPage ✅
- Added `liveWaves` state, `handleWaveUpdated` callback
- Table rows are now clickable → opens EditWaveDrawer
- `sortedWaves` now derived from `liveWaves` so color/date updates reflect immediately
