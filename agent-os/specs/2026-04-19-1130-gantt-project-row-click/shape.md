# Gantt Project Row Whole-Cell Click — Shaping Notes

## Scope

Make the entire left panel cell of a project row in WaveGanttChart clickable for timeline auto-scroll (`scrollToBar`), matching the intent of the task row. The collapse chevron must still only toggle collapse, not trigger scroll.

## Decisions

- Add `onClick={() => scrollToBar(p.id)}` on the project left panel grid wrapper div
- Add `e.stopPropagation()` to the collapse icon span's onClick to prevent bubbling
- No changes needed to the action button or Jira label link — both already call `e.stopPropagation()`
- No changes to the task row (name-only click is sufficient there)

## Context

- **Visuals:** None
- **References:** Task row name span (`onClick={() => scrollToBar(task.id)}`), project name span (same pattern)
- **Product alignment:** N/A
