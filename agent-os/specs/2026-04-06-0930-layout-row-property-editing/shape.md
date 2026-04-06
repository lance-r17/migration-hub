# Layout Row Property Editing — Shaping Notes

## Scope

When the user clicks a layout row on the email builder canvas, the right panel should show layout-specific editable properties — just like clicking a component shows component properties. Selecting a row clears the component selection and vice versa.

**Table layout (explicitly requested):**
- Style tab: number of columns (1–6), number of rows/preview (1–10)
- Content tab: header enable toggle, header text, datasource (template variable with variable picker)

**All layouts:**
- Style tab: row background color

**Two-col layout:**
- Style tab: column width ratio presets (50/50, 60/40, 70/30, 40/60, 30/70)

**Left-sidebar layout:**
- Style tab: sidebar width presets (25%, 30%, 35%, 40%)

**Template section hiding (added during shaping):**
- When any component or row is selected, the template-level properties (font, colors, max-width, padding) are hidden in the Style tab, and the template config (event type, subject, recipients) is hidden in the Config tab. This keeps the panel focused on what's selected.

## Decisions

- Row selection uses a separate `selectedRowId` state alongside the existing `selectedId` (component). They are mutually exclusive — selecting one clears the other.
- Clicking a component inside a row should not propagate up to select the row (`stopPropagation` in CanvasColumn/CanvasComponent click handlers).
- `TableConfig` is stored on `EmailRow` as an optional field (only populated when `layout === 'table'`).
- `columnWidths` stored as `string[]` on `EmailRow` to override default column proportions.
- Datasource uses a template variable text input with the existing variable badge picker pattern.
- When `numCols` changes for table layout, the `columns` array is synced (columns added or trimmed from end).

## Context

- **Visuals:** None provided
- **References:** Existing `StyleTab.tsx` component/template section patterns; `ContentTab.tsx` variable badge pattern
- **Product alignment:** N/A

## Standards Applied

- Frontend component patterns from the existing email builder (shadcn/ui components, Tailwind styling)
