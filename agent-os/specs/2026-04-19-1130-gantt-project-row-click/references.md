# References for Gantt Project Row Whole-Cell Click

## Similar Implementations

### Task row name click (scroll)

- **Location:** `frontend/src/components/waves/WaveGanttChart.tsx` ~line 1176
- **Pattern:** `<span onClick={() => scrollToBar(task.id)}>` on the name span only

### scrollToBar function

- **Location:** `frontend/src/components/waves/WaveGanttChart.tsx` ~lines 595–603
- **Pattern:** Queries `[data-bar-id]` in the scroll container, centers it horizontally
