# Plan — Inline Full-Width Rich Text Editor with Variable Autocomplete

## Task 1: Save spec documentation ✅

## Task 2: Lift editing state — `EmailBuilderLayout` + `Canvas` ✅

- `EmailBuilderLayout`: added `editingComponentId` state, `handleStartEdit`, `handleFinishEdit`; threads all + `editorRef` to `Canvas`
- `Canvas`: threads `editingComponentId`, `onStartEdit`, `onFinishEdit`, `editorRef` to each `CanvasRow`

## Task 3: Full-width overlay — `CanvasRow` ✅

- Finds editing component and its `colId` within the row's columns
- Wraps columns in a `relative` div; dims them (`opacity-30 pointer-events-none`) when editing
- Renders `<RichTextEditor>` in `absolute inset-0 z-40 p-2` overlay when editing

## Task 4: Thread props — `CanvasColumn` + `CanvasComponent` ✅

- `CanvasColumn`: added `editingComponentId` + `onStartEdit`; passes `isEditing` + `onStartEdit` to each `CanvasComponent`
- `CanvasComponent`: removed local `[editing, setEditing]` state; double-click calls `onStartEdit(id)`;  removed inline `RichTextEditor` render

## Task 5: Enhance `RichTextEditor` ✅

- `editorRef` wired via `useEffect` → enables right-panel variable badge insertion
- Escape key closes editor (when no variable menu open)
- `{{` detection in `onUpdate` using `textBetween` + `coordsAtPos`
- Filtered variable list; dropdown with keyboard navigation (↑↓ / Enter / Tab / Escape)
- Outer container changed to `w-full` + `overflow-visible`
- Hint label "Type {{ for variables" in toolbar
