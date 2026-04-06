# Rich Editor Toolbar Enhancements — Shaping Notes

## Scope

Enhance the Tiptap-based `RichTextEditor` in the email builder with:

1. **Font size control** — dropdown showing current font size, allowing inline size changes (10–32px)
2. **Uppercase toggle** — button that applies/removes `text-transform: uppercase` on selected text, reflects active state
3. **Variable `{}` button** — replaces the passive hint "Type {{ for variables" with an active button that inserts `{{` at cursor, triggering the existing autocomplete popup
4. **Remove hint text** — "Type {{ for variables" tip is removed

## Decisions

- Font size uses `@tiptap/extension-font-size` (new dependency) which works with existing `TextStyle` extension
- Uppercase is a custom inline Tiptap mark (no separate file) applying `text-transform: uppercase` via a `<span>` wrapper
- Variable `{}` button inserts `{{` which fires the existing `onUpdate` regex detection — no new mechanism needed
- Toolbar order: Bold | Italic | Underline | [sep] | FontSize | Uppercase | [sep] | Link | [sep] | Color | [flex] | {}

## Context

- **Visuals:** None provided
- **References:** `RichTextEditor.tsx` (current implementation studied in full)
- **Product alignment:** Improves authoring UX for email template editors; WYSIWYG principle

## Standards Applied

- N/A (frontend-only UI enhancement, no API or DB changes)
