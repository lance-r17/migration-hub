# Remove Jira Project Key + Combine Dates into Range Picker

## Context

Two changes to `CreateWaveDrawer`:
1. **Remove Jira Project Key field** — The backend already knows the configured project key; users shouldn't need to supply it.
2. **Combine Start Date + Cutover Date into a date range picker** — The two separate `<input type="date">` fields are replaced with a single calendar range picker (Popover + Calendar) matching the existing pattern used in `DateRangeEntryEditor`.

## Files Modified

- `frontend/src/components/drawers/CreateWaveDrawer.tsx`
- `frontend/src/services/waves.ts`
