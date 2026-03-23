# Plan: DateRangeEntry for Blackout Dates & Change Freeze Periods

## Tasks

1. Install `npx shadcn add calendar popover` + `npm install date-fns`
2. Add `DateRangeEntry` interface to `src/types/index.ts`; update `MigrationConstraints`
3. Update mock data in `src/data/mock.ts` to use `DateRangeEntry` objects
4. Create `src/components/drawers/DateRangeEntryEditor.tsx`
5. Update `src/components/drawers/ScheduleWindowsDrawer.tsx`
6. Update `src/components/project/MigrationCutoverSection.tsx` display
