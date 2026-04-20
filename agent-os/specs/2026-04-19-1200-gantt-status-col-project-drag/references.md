# References

## Task Row Drag (existing pattern, reused for project rows)

- **Location:** `frontend/src/components/waves/WaveGanttChart.tsx`
- **Relevance:** Project row drag mirrors this exactly — same ghost element pattern, same pointer event lifecycle, same visual dimming
- **Key patterns:**
  - `RowDragState` interface with sourceIndex/overIndex
  - `onRowPointerMove` + `onRowPointerUp` + `useEffect` for event subscription
  - `data-task-row-project` / `data-task-row-index` for hit-testing
  - `ghostRef` fixed div following cursor

## Wave service + fromApi pattern

- **Location:** `frontend/src/services/waves.ts`
- **Relevance:** Added `project_order` to `WaveApiRecord` and `fromApi` mapping
