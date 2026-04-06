# References for Text Block Tiptap Compatibility

## emailTemplates.ts

- **Location:** `frontend/src/data/emailTemplates.ts`
- **Relevance:** Contains all predefined template HTML — the file being rewritten
- **Key patterns:** `textComponent(html)` helper; inline HTML strings with block-level style attributes

## TemplateRenderer.tsx

- **Location:** `frontend/src/components/email-builder/preview/TemplateRenderer.tsx`
- **Relevance:** Generates standalone email HTML; text wrapper div needs `class="prose"` so
  the embedded `.prose` CSS rules apply (compensating for removed inline margin/line-height)
- **Embedded CSS already present:**
  ```css
  .prose p { margin: 0; line-height: 1.6; }
  .prose h1, .prose h2, .prose h3 { margin: 0 0 8px; }
  .prose ul, .prose ol { margin: 4px 0; padding-left: 20px; }
  .prose a { color: <accentColor>; }
  ```

## RichTextEditor.tsx

- **Location:** `frontend/src/components/email-builder/builder/canvas/RichTextEditor.tsx`
- **Relevance:** Tiptap extensions determine the parse rules that drive toolbar state
  - `Color` reads `color` from `<span style="color:...">` (TextStyle spans only)
  - `FontSize` (custom) reads `fontSize` from `<span style="font-size:...">` (TextStyle spans only)
  - `Uppercase` (custom) reads `text-transform: uppercase` from span elements
  - Block-level inline styles are ignored by these mark parsers
