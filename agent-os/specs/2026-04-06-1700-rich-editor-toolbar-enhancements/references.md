# References for Rich Editor Toolbar Enhancements

## Similar Implementations

### RichTextEditor (current)

- **Location:** `frontend/src/components/email-builder/builder/canvas/RichTextEditor.tsx`
- **Relevance:** The file being modified; studied to understand existing toolbar pattern, variable autocomplete mechanism, and Tiptap extension setup
- **Key patterns:**
  - Toolbar buttons use `onMouseDown` with `e.preventDefault()` to avoid editor blur
  - Active state checked via `editor.isActive('markName')`
  - Variable autocomplete triggered by `onUpdate` handler detecting `\{\{([^{}]*)$` regex
  - `commitVariable` replaces the partial `{{...` text with the full `{{variable.key}}`

### Tiptap Extensions Used

- `@tiptap/extension-text-style` — provides `TextStyle` mark for inline CSS attributes (color, font-size)
- `@tiptap/extension-color` — adds `setColor` command on top of `TextStyle`
- `@tiptap/extension-font-size` — adds `setFontSize`/`unsetFontSize` commands on top of `TextStyle`
- `@tiptap/extension-underline` — underline mark
- `@tiptap/extension-link` — link mark
