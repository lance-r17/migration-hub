# Text Block Tiptap Compatibility — Shaping Notes

## Scope

Rewrite all predefined email template text-block HTML so that when opened in the Tiptap
rich editor the toolbar correctly reflects the active styles (color, font-size, uppercase).

Also add `class="prose"` to the text component wrapper in `TemplateRenderer.tsx` so that
the embedded `.prose` CSS rules still normalise paragraph margins/line-height in the
email output after removing per-element inline margin/line-height attributes.

## Decisions

- Block-level inline style attributes (`color`, `font-size`, `text-transform`) moved to
  `<span style="...">` inside the element — Tiptap's TextStyle extensions parse these from spans only
- `margin:0; line-height:1.6` removed from `<p>` tags — prose CSS handles both
- `text-align:center` removed from footer `<p>` tags — added as `textAlign:'center'` on the
  component `style` object; exposed as the `textComponent()` helper's second argument
- `letter-spacing` dropped — no Tiptap extension supports it
- `font-weight:600` on non-heading text replaced with `<strong>` tag

## Context

- **Visuals:** None
- **References:** `emailTemplates.ts`, `TemplateRenderer.tsx`, `RichTextEditor.tsx`
- **Product alignment:** N/A — internal tooling improvement

## Standards Applied

- N/A (frontend data/render fix, no API or DB changes)
