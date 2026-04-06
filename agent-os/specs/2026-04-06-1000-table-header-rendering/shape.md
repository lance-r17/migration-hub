# Table Header Rendering Fix — Shaping Notes

## Scope

Bug fix: after enabling the header row and filling header text for a table layout row, neither the canvas nor the email preview displays the header.

## Decisions

- Changed `TableConfig.headerText: string` (comma-separated) to `headerTexts: string[]` for per-column inputs — cleaner UX
- Canvas shows header cells with muted/dashed style to distinguish from content columns
- Preview `<th>` elements use `accentColor` tint background and bottom border for styling
- Column widths for table layout now computed dynamically from `row.columns.length` instead of hardcoded 3 columns

## Context

- **Visuals:** None
- **References:** Existing `CanvasRow.tsx` column rendering pattern; `TemplateRenderer.renderRow()` pattern
- **Product alignment:** N/A

## Standards Applied

None formally — standard React/TypeScript patterns used throughout.
