# References

## StringListEditor

- **Location:** `src/components/drawers/StringListEditor.tsx`
- **Relevance:** The existing list editor being replaced for these two fields
- **Key patterns:** Add button appends empty item; delete removes by index; `onChange` fires on every mutation

## ScheduleWindowsDrawer

- **Location:** `src/components/drawers/ScheduleWindowsDrawer.tsx`
- **Relevance:** Target drawer; currently uses `StringListEditor` for both fields

## MigrationCutoverSection

- **Location:** `src/components/project/MigrationCutoverSection.tsx`
- **Relevance:** Read-only display; needs updating to render `DateRangeEntry` name + formatted dates
