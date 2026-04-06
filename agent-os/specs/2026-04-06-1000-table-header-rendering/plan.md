# Table Header Rendering Fix — Plan

## Summary

Fix table layout header not appearing in canvas or preview after being enabled and filled in the Content tab.

## Root Cause

The data is stored correctly in `tableConfig.headerTexts[]` but neither `CanvasRow` nor `TemplateRenderer` reads it during render.

## Key Files

- `frontend/src/types/email.ts` — Changed `headerText: string` → `headerTexts: string[]`
- `frontend/src/components/email-builder/builder/right-panel/ContentTab.tsx` — Per-column header inputs
- `frontend/src/components/email-builder/builder/right-panel/StyleTab.tsx` — Default `headerTexts: []`
- `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx` — Render header cells above columns
- `frontend/src/components/email-builder/preview/TemplateRenderer.tsx` — Emit `<th>` header row in HTML
