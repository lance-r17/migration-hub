# Inline Full-Width Rich Text Editor — Shaping Notes

## Scope

Replace the column-constrained inline editor overlay with a full-width editor that covers the entire row when a text or CTA block is double-clicked. Add a `{{` variable autocomplete dropdown that filters as the user types.

## Decisions

- **Full-width via row overlay**: Editing state is lifted from `CanvasComponent` to `EmailBuilderLayout`. `CanvasRow` renders a full-width `RichTextEditor` overlay (`absolute inset-0 z-40`) with original columns dimmed underneath (`opacity-30 pointer-events-none`). No change to the row DOM structure.
- **Filter-as-you-type autocomplete**: Typing `{{` opens a dropdown. Each subsequent character filters `TEMPLATE_VARIABLES` by key or label. Arrow keys navigate, Enter/Tab commits, Escape dismisses without inserting.
- **Close behavior**: Click outside the editor or press Escape (when no variable menu is open).
- **`editorRef` wired**: The existing `editorRef` from `EmailBuilderLayout` is threaded to `RichTextEditor` so the right-panel variable badges can still insert into the active editor.
- **No new packages required**: `{{` detection uses TipTap's `editor.state.doc.textBetween` + `editor.view.coordsAtPos`. No `@tiptap/suggestion` needed.

## Context

- **Visuals:** None provided
- **References:** Existing `RichTextEditor`, `CanvasComponent`, `CanvasRow`, `CanvasColumn`, `EmailBuilderLayout`, `Canvas`
- **Product alignment:** N/A — UX improvement to the email builder

## Standards Applied

None applicable (pure frontend UX component, no API or database changes).
