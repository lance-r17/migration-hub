# Plan: Rich Editor Toolbar Enhancements

## Task 1: Save spec documentation ✅

Spec saved to `agent-os/specs/2026-04-06-1700-rich-editor-toolbar-enhancements/`.

## Task 2: Install @tiptap/extension-font-size

```
cd frontend && npm install @tiptap/extension-font-size
```

## Task 3: Enhance RichTextEditor.tsx

### New imports
- `FontSize` from `@tiptap/extension-font-size`
- `Mark`, `mergeAttributes` from `@tiptap/core`
- `CaseUpper` from `lucide-react`

### New Uppercase mark (before component)
Custom Tiptap mark that applies `text-transform: uppercase` inline.

### Updated extensions list
Add `FontSize` and `Uppercase` to `useEditor` extensions.

### Variable trigger handler
`insertVariableTrigger()` inserts `{{` at cursor — reuses existing autocomplete detection.

### Toolbar changes
- Add font size `<select>` after Underline separator
- Add Uppercase `<Button>` after font size
- Replace hint `<span>` with `{}` `<Button>` at right end

## Verification

1. Double-click a text component → editor toolbar shows all new controls
2. Font size dropdown reads current selection's size, changes it on select
3. Uppercase button highlights when selection is uppercased
4. `{}` button inserts `{{` and opens variable picker
5. "Type {{ for variables" hint is gone
6. Typing `{{` manually still triggers autocomplete
