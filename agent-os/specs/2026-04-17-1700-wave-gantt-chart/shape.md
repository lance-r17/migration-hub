# Wave Gantt Chart — Shaping Notes

## Scope

A new "Gantt Chart" button on WavesPage opens a full-screen modal. The modal contains a split-panel Gantt chart:
- Left panel: tree list of wave groups with expandable project sub-rows
- Right panel: horizontally scrollable timeline with date columns, wave bars, and project bars

Two new project-level DB columns: `planned_start_date`, `planned_end_date`.
Only editable via drag in the Gantt (no separate edit UI in project details).

## Decisions

- Full-screen modal pattern (mirrors WavePlanningModal) — consistent UX
- Extended fixed timeline: Jan 1(year−1) → Dec 31(year+1) of wave range — no virtualization needed
- Project bars draggable via pointer events (not @dnd-kit, which is for vertical reordering)
- Three drag modes: move body (shift both dates), drag left edge (resize start), drag right edge (resize end)
- Empty project rows (no planned dates) show `+ Set dates` button → inline popover with date inputs
- Jira story date sync: best-effort fire-and-forget on PATCH /planned-dates
- Pre-fill initial dates from `migrationConstraints.earliestStartDate` / `latestEndDate`

## Context

- **Visuals:** `/workspaces/migration-hub/IMG_7191.PNG` — ClickUp-style Gantt with hierarchical rows
- **References:** WavePlanningModal.tsx, WavePlanningBoard.tsx
- **Product alignment:** Phase 2 roadmap item "Migration progress dashboard"
