# Gantt Blocked Reason Tooltip — Shaping Notes

## Scope

Add a hover tooltip to the status badge in the Gantt left panel that shows the block reason when a project is blocked. The `blockedReason` field already exists on the `Project` type (added in migration 0019) but was not surfaced in the Gantt.

## Decisions

- Only show tooltip when **both** `status === 'blocked'` and `blockedReason` is non-empty — legacy blocked projects without a reason get no tooltip (no broken state).
- `cursor-help` added to the badge to signal the tooltip is available.
- `side="top"` matches the EffortCell tooltip pattern already in the same file.
- Single-file change, no new imports needed.

## Context

- **Visuals:** None
- **References:** `WaveGanttChart.tsx:193-229` (EffortCell tooltip — exact same Tooltip/TooltipTrigger/TooltipContent pattern in same file)
- **Product alignment:** N/A
