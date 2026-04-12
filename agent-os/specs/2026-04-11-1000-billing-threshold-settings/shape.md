# Billing Threshold Settings — Shaping Notes

## Scope

Add a `/settings/billing` page that lets Platform Migration Leads configure the two ratio boundaries used in the Finance page billing comparison:
- **Healthy / At Risk boundary** (default 100) — ratios below this are Healthy
- **At Risk / Over boundary** (default 120) — ratios above this are Over

Both thresholds are stored persistently (backend; mock store for now) so all users see the same values.

## Decisions

- Both boundaries configurable (not just the upper one)
- Dedicated settings page at `/settings/billing`, following the same pattern as Embargo Periods
- Backend/persistent storage (mock store in current frontend-only phase)
- Validation: both must be positive numbers; lower boundary must be strictly less than upper
- Finance page fetches thresholds on mount and falls back to defaults (100/120) on error

## Context

- **Visuals:** None
- **References:** EmbargoPage.tsx (page layout pattern), surveyService.ts (settings service pattern), store.ts (mock store pattern)
- **Product alignment:** Supports flexible migration cost governance without code changes
