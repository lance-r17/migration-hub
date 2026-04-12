# Ratio Filter Tooltips — Shaping Notes

## Scope

Add hover tooltips to the four ratio status filter buttons (Healthy, At Risk, Over, No Data) on the Finance page. Tooltip text shows the actual threshold ranges dynamically, so it stays in sync when thresholds are changed in Settings.

## Decisions

- Dynamic tooltip text — shows actual threshold numbers (e.g. "Ratio < 100%"), not fixed prose
- `tooltipFn: (t: BillingThresholdConfig) => string` added to `RATIO_STATUS_CONFIG` so the text is generated at render time from the live `thresholds` state
- `TooltipProvider` wraps only the filter button group, not the whole page

## Context

- **Visuals:** None
- **References:** `frontend/src/components/ui/tooltip.tsx` (Radix-based, already in codebase)
- **Product alignment:** Complements the configurable billing thresholds feature (2026-04-11-1000)
