# Remove Jira Project Key Field — Shaping Notes

## Scope

Remove `jiraProjectKey` user input from the Create Wave form and replace the two separate date inputs with a unified date range calendar picker.

## Decisions

- `jiraProjectKey` stays on the `Wave` type (backend still provides it); only removed from the create input
- Mock service defaults to `'MIG'` (matches all existing mock data)
- Date range picker uses Popover + Calendar with `mode="range"` and `numberOfMonths={2}` — same pattern as `DateRangeEntryEditor`
- Popover auto-closes when both start and end dates are selected

## Context

- **Visuals:** None provided
- **References:** `frontend/src/components/drawers/DateRangeEntryEditor.tsx` — existing range picker pattern
- **Product alignment:** Simplifies wave creation UX; project key is a backend config concern
