# References for Table Header Rendering Fix

## Similar Implementations

### CanvasRow column rendering

- **Location:** `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx`
- **Relevance:** Pattern for rendering column cells; header row follows the same flex layout
- **Key patterns:** `row.columns.map()` with `flex-1` spans; conditional render based on `row.layout`

### TemplateRenderer renderRow

- **Location:** `frontend/src/components/email-builder/preview/TemplateRenderer.tsx`
- **Relevance:** Where table header `<th>` elements are emitted in the HTML output
- **Key patterns:** `switch (row.layout)` for column widths; `row.columns.map()` for cell generation
