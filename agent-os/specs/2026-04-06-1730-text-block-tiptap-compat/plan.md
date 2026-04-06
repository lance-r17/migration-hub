# Plan: Text Block Tiptap Compatibility

## Task 1: Save spec documentation ✅

## Task 2: Update emailTemplates.ts

- Add optional `textAlign` parameter to `textComponent()` helper (default `'left'`)
- Rewrite all 27 text component HTML strings across 8 templates
- Update footer rows to use `textComponent(html, 'center')` instead of inline text-align

## Task 3: Add class="prose" to text wrapper in TemplateRenderer.tsx

Change line 38:
```ts
return `<div style="${base}">${html}</div>`
```
to:
```ts
return `<div class="prose" style="${base}">${html}</div>`
```
