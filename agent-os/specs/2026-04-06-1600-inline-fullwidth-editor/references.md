# References — Inline Full-Width Editor

## Key Files Modified

### `frontend/src/components/email-builder/builder/canvas/RichTextEditor.tsx`
- **Role:** TipTap-based editor component
- **Changes:** Added `editorRef` wiring, `{{` autocomplete detection, variable dropdown render, Escape handler, full-width styling

### `frontend/src/components/email-builder/builder/canvas/CanvasComponent.tsx`
- **Role:** Renders a single draggable email component on the canvas
- **Changes:** Removed local `editing` state; double-click now calls `onStartEdit(id)` instead

### `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx`
- **Role:** Renders a row with one or more columns
- **Changes:** Finds editing component within its columns, renders full-width overlay; columns dimmed during editing

### `frontend/src/components/email-builder/builder/canvas/CanvasColumn.tsx`
- **Role:** Renders a droppable column with its components
- **Changes:** Threads `editingComponentId` and `onStartEdit` to each `CanvasComponent`

### `frontend/src/components/email-builder/builder/Canvas.tsx`
- **Role:** Canvas wrapper, coordinates rows and drop zones
- **Changes:** Threads `editingComponentId`, `onStartEdit`, `onFinishEdit`, `editorRef` to each `CanvasRow`

### `frontend/src/components/email-builder/builder/EmailBuilderLayout.tsx`
- **Role:** Top-level state container for the email builder
- **Changes:** Added `editingComponentId` state + `handleStartEdit` / `handleFinishEdit` callbacks

## Existing Data

- `TEMPLATE_VARIABLES` in `frontend/src/types/email.ts` — canonical variable list used by the autocomplete
