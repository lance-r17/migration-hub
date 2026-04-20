# Gantt: Wider Status Column + Project Row Drag-to-Reorder

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/waves/WaveGanttChart.tsx` | LP_GRID 80→100px, ProjRowDragState, drag handlers, ghost, data attrs |
| `frontend/src/components/waves/WaveGanttModal.tsx` | liveWaves state, handleUpdateProjectOrder |
| `frontend/src/types/wave.ts` | Added `projectOrder?: string[]` |
| `frontend/src/services/waves.ts` | Added `project_order` to WaveApiRecord, fromApi mapping, updateProjectOrder() |
| `backend/app/models/wave.py` | Added `project_order` JSONB column |
| `backend/app/schemas/wave.py` | Added `project_order` to WaveOut |
| `backend/app/routers/waves.py` | New `PATCH /waves/{wave_id}/project-order` endpoint |
| `backend/alembic/versions/0006_add_wave_project_order.py` | Migration |
