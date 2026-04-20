# Edit Wave Drawer — Shaping Notes

## Scope

Add an edit drawer to WavesPage that opens when a user clicks a wave row. The drawer provides:
1. A color swatch picker to update the wave's color (10 predefined hex swatches)
2. A "Sync from Jira" button to pull the latest start date, cutover date, and status from the linked Jira epic

## Decisions

- Entry point: click anywhere on a wave table row (no extra edit button)
- Editable fields: color only + Jira sync (no manual date/name editing in this drawer)
- Sync UX: auto-apply & save — fetch from Jira and immediately PATCH, show toast
- Color save and Jira sync are independent actions with separate loading states
- `liveWaves` local state mirrors the `useWaves` hook pattern used by `liveProjects`

## Context

- **Visuals:** None
- **References:** CreateWaveDrawer.tsx (color picker pattern), useWaves hook, liveProjects pattern in WavesPage
- **Product alignment:** N/A

## Standards Applied

- Existing drawer pattern: `side="right" w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0 showCloseButton={false}`
- fromApi/toApi mapper pattern in waves.ts service layer
