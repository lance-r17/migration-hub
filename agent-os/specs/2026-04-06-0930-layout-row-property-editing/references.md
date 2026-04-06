# References for Layout Row Property Editing

## Similar Implementations

### Component Property Editing (StyleTab / ContentTab)

- **Location:** `frontend/src/components/email-builder/builder/right-panel/StyleTab.tsx`
- **Relevance:** The component-level style section (padding, alignment, type-specific props) is the direct pattern to replicate for row-level properties.
- **Key patterns:** `ColorField` and `NumberField` helper components; conditional rendering by component type; `onComponentStyleChange` callback pattern.

### Variable Badge Picker (ContentTab)

- **Location:** `frontend/src/components/email-builder/builder/right-panel/ContentTab.tsx`
- **Relevance:** The datasource field for table layout reuses this pattern — grouped variable badges, clicking inserts `{{variable}}` into the input.
- **Key patterns:** `groupVariables()` helper; `TEMPLATE_VARIABLES` from `@/types/email`; Badge onClick with ref-based insertion.

### Row Drag Handle (CanvasRow)

- **Location:** `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx`
- **Relevance:** The existing row hover/interaction pattern (opacity-0 → group-hover:opacity-100 controls). Row selection adds a click handler and ring border on top of this.
- **Key patterns:** `group/row` class, `isDragging` visual state, `useSortable` hook.

### Column Width Layout

- **Location:** `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx` — `getColumnLayout()`
- **Relevance:** The function that maps `LayoutType` to Tailwind width classes needs to be updated to read `row.columnWidths` overrides.
