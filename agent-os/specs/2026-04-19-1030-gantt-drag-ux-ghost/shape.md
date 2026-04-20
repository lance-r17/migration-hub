# Gantt Task Drag UX — Ghost + Live Reorder — Shaping Notes

## Scope

Improve the drag-to-reorder UX in `WaveGanttChart.tsx`:
1. **Ghost row**: a floating clone of the dragged row's left panel follows the cursor Y
2. **Live reorder preview**: rows shift into their new visual order as you drag (source row becomes a placeholder, other rows re-sort around it)

## Decisions

- **Ghost**: `position: fixed` div cloning the left-panel content (600px wide), updated via direct DOM ref (no React re-render on every pointermove)
- **Live reorder**: reorder the dragged project's task array inside the `rows` useMemo based on `rowDragState`, so React re-renders the rows in preview order
- **Placeholder styling**: dragged task's in-list row renders with `bg-[var(--g-accent-soft)]` + 30% opacity on content — no separate drop indicator line (the row itself is the target indicator)
- **overIndex detection**: keep existing `elementFromPoint → data-task-row-project/index` approach; the `data-task-row-index` attribute reflects the live display position, which is stable under reorder
- **Ghost Y**: updated via `ghostRef.current.style.top` directly in `onRowPointerMove` (avoids React re-render cycle)

## Context

- **Visuals**: None
- **References**: Current `WaveGanttChart.tsx` pointer event system; prior task-reorder implementation (this session)
- **Product alignment**: N/A

## Standards Applied

- Lucide icons via `lucide-react`
- No inline state re-renders for animation: DOM ref for ghost position
