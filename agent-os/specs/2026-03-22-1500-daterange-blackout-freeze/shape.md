# DateRangeEntry — Blackout Dates & Change Freeze Periods

## Scope

Replace `string[]` for `blackoutDates` and `changeFreezePeriods` in `MigrationConstraints` with a structured `DateRangeEntry[]` model (`name` + `from` ISO date + optional `to` ISO date). Update the edit drawer to use a name `<Input />` + Popover/Calendar date range picker per entry. Update the read-only display to render name + formatted date range.

## Decisions

- `to` is optional — single-day entries set only `from`; omit `to`
- Dates stored as ISO date strings (`'YYYY-MM-DD'`) — avoids serialization issues
- Install `shadcn add calendar popover` + `date-fns` as part of implementation
- New `DateRangeEntryEditor` component handles both fields (reusable)

## Context

- **Visuals:** User provided a Popover + Calendar date range picker code snippet
- **References:** `ScheduleWindowsDrawer.tsx`, `StringListEditor.tsx`, `MigrationCutoverSection.tsx`
- **Product alignment:** N/A — UI polish / data model improvement

## Standards Applied

- Frontend-only change; existing shadcn/ui + Tailwind CSS patterns apply
