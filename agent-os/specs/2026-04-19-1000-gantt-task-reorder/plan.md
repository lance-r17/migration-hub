# Plan: Gantt Task Drag-to-Reorder

See `/home/node/.claude/plans/frontend-src-components-waves-wavegantt-fuzzy-parrot.md` for the full implementation plan.

## Summary

- Replace `ListTodo` with `GripVertical` as a drag handle on task rows
- Add `RowDragState` interface + state
- Extend pointer event system (same pattern as existing bar drag)
- Use `data-task-row-project` / `data-task-row-index` DOM attributes to identify hovered row during drag
- Show 2px accent-colored drop indicator at insertion point
- On drop: splice tasks array, call `onUpdatePlanning` with rollback on error

**Single file changed:** `frontend/src/components/waves/WaveGanttChart.tsx`
