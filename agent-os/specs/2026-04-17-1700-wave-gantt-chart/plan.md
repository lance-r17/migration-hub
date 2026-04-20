# Wave Gantt Chart + Project Planned Dates — Plan

See `/home/node/.claude/plans/lively-finding-clover.md` for the full approved implementation plan.

## Summary

- New full-screen modal Gantt chart view on WavesPage (alongside existing Planning Board)
- Two new project-level fields: `plannedStartDate` / `plannedEndDate`
- Editable only by dragging bars in the Gantt chart
- Wave bars are read-only; project bars are draggable (move + resize)
- Syncs to Jira story Target Start/End Date custom fields when a story exists
- Timeline spans Jan 1 (min wave year − 1) → Dec 31 (max wave year + 1)
