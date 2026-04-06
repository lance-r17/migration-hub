# Layout Row Property Editing — Plan

See the main implementation plan at `/home/node/.claude/plans/rustling-puzzling-rabin.md`.

## Summary

Add row selection to the email builder canvas so that clicking a layout row shows its editable properties in the right panel. Selecting a row clears any active component selection and vice versa.

## Key Files

- `frontend/src/types/email.ts` — New `TableConfig`, `RowStyle` types; extended `EmailRow`
- `frontend/src/components/email-builder/builder/EmailBuilderLayout.tsx` — Row selection state + mutation helpers
- `frontend/src/components/email-builder/builder/Canvas.tsx` — Pass row selection props
- `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx` — Selectable rows + columnWidths rendering
- `frontend/src/components/email-builder/builder/canvas/CanvasColumn.tsx` — stopPropagation on click
- `frontend/src/components/email-builder/builder/canvas/CanvasComponent.tsx` — stopPropagation on click
- `frontend/src/components/email-builder/builder/RightPanel.tsx` — Forward row props to tabs
- `frontend/src/components/email-builder/builder/right-panel/StyleTab.tsx` — Template hiding + layout section
- `frontend/src/components/email-builder/builder/right-panel/ContentTab.tsx` — Table content section
- `frontend/src/components/email-builder/builder/right-panel/ConfigTab.tsx` — Template hiding
