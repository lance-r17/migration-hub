# References for Gantt Task Drag-to-Reorder

## Similar Implementations

### SurveyBuilderSection — native drag with GripVertical

- **Location:** `frontend/src/components/settings/SurveyBuilderSection.tsx` (lines 62–151)
- **Relevance:** Uses `GripVertical` icon as a drag handle on list rows; tracks `dragIndexRef` + `dragOverIndex` state; drops reorder the array
- **Key patterns:** `dragstart`/`dragover`/`drop` HTML5 events on rows; drop re-splices the array

### WaveGanttChart — existing pointer event drag system

- **Location:** `frontend/src/components/waves/WaveGanttChart.tsx` (lines 260–337)
- **Relevance:** The component already manages pointer events via `window.addEventListener('pointermove'/'pointerup')` in a `useEffect`; a parallel `rowDragState` can follow the same pattern
- **Key patterns:** Separate `useState` for drag state; `useEffect` subscribes/unsubscribes global listeners; local planning update optimistically then persists via `onUpdatePlanning`
