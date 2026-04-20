# Gantt Status Column Width + Project Row Drag — Shaping Notes

## Scope

Two targeted UX improvements to the Wave Gantt Chart left panel:

1. **Status column width**: Increase from 80px to 100px so status badges like "in-progress" and "signed-off" render without clipping.
2. **Project row drag-to-reorder**: Add a grab handle on project rows allowing manual reordering within a wave. Order persists to the backend via a new `project_order` JSONB field on waves.

## Decisions

- Status column: 100px chosen (over 110px/120px) — enough room for longest status labels without noticeably squeezing the name column.
- Persistence: backend JSONB array on `waves.project_order` (over localStorage) — persists across sessions and users.
- New endpoint: `PATCH /waves/{wave_id}/project-order` rather than reusing `PATCH /waves/{wave_id}` — keeps the intent explicit and avoids accidentally clobbering other wave fields.
- Ghost element: separate `projGhostRef` and ghost div to avoid interfering with the existing task row ghost.
- Fallback: alphabetical sort preserved when `projectOrder` is null/empty.
- Unassigned projects: no drag handle (no wave to associate the order with).

## Context

- **Visuals:** None provided
- **References:** Existing task row drag in `WaveGanttChart.tsx` (RowDragState, onRowPointerMove, onRowPointerUp, ghost element)
- **Product alignment:** N/A

## Standards Applied

- None explicitly — small targeted change, follows existing patterns in the file.
