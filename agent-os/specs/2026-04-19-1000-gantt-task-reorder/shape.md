# Gantt Task Drag-to-Reorder — Shaping Notes

## Scope

Replace the `ListTodo` icon in each task row's name column with a `GripVertical` drag handle. Users can grab it to reorder tasks within the same project. Reordering persists via `onUpdatePlanning`.

## Decisions

- **Handle**: Replace `ListTodo` icon entirely with `GripVertical` (always visible, clearly signals draggability)
- **Scope**: Within the same project only — no cross-project dragging
- **Implementation**: Extend the existing custom pointer event system (no new dnd-kit dependency on this component)
- **Drop indicator**: 2px colored line shown at insertion point between task rows

## Context

- **Visuals**: ASCII mockup confirmed by user (GripVertical replaces ListTodo)
- **References**: SurveyBuilderSection.tsx (native drag with GripVertical), existing WaveGanttChart pointer event system
- **Product alignment**: N/A

## Standards Applied

- Lucide icons via `lucide-react`
- No `any` types — use typed state
