# Email Builder — Plan

See `/home/node/.claude/plans/effervescent-knitting-moler.md` for the full implementation plan.

## Summary

10-task implementation covering:
1. Spec documentation (this folder)
2. Install @dnd-kit/* and @tiptap/* dependencies
3. `frontend/src/types/email.ts` — all interfaces + TEMPLATE_VARIABLES
4. `frontend/src/data/emailTemplates.ts` + `frontend/src/services/emailService.ts`
5. EmailTemplatesPage + TemplateCard + CreateTemplateCard + routing + nav
6. EmailBuilderLayout + LeftPanel + LayoutsTab + LibraryTab + EmailBuilderPage
7. Canvas + CanvasRow + CanvasColumn + CanvasComponent + ComponentToolbar (dnd-kit)
8. RichTextEditor (Tiptap in Popover)
9. RightPanel + StyleTab + ContentTab + ConfigTab
10. EmailPreviewPage + BrowserContainer + TemplateRenderer

## New Files (26 total)

### Types & Data
- `frontend/src/types/email.ts`
- `frontend/src/data/emailTemplates.ts`
- `frontend/src/services/emailService.ts`

### Pages
- `frontend/src/pages/EmailTemplatesPage.tsx`
- `frontend/src/pages/EmailBuilderPage.tsx`
- `frontend/src/pages/EmailPreviewPage.tsx`

### Components
- `frontend/src/components/email-builder/TemplateCard.tsx`
- `frontend/src/components/email-builder/CreateTemplateCard.tsx`
- `frontend/src/components/email-builder/builder/EmailBuilderLayout.tsx`
- `frontend/src/components/email-builder/builder/LeftPanel.tsx`
- `frontend/src/components/email-builder/builder/Canvas.tsx`
- `frontend/src/components/email-builder/builder/RightPanel.tsx`
- `frontend/src/components/email-builder/builder/left-panel/LayoutsTab.tsx`
- `frontend/src/components/email-builder/builder/left-panel/LibraryTab.tsx`
- `frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx`
- `frontend/src/components/email-builder/builder/canvas/CanvasColumn.tsx`
- `frontend/src/components/email-builder/builder/canvas/CanvasComponent.tsx`
- `frontend/src/components/email-builder/builder/canvas/ComponentToolbar.tsx`
- `frontend/src/components/email-builder/builder/canvas/RichTextEditor.tsx`
- `frontend/src/components/email-builder/builder/right-panel/StyleTab.tsx`
- `frontend/src/components/email-builder/builder/right-panel/ContentTab.tsx`
- `frontend/src/components/email-builder/builder/right-panel/ConfigTab.tsx`
- `frontend/src/components/email-builder/preview/BrowserContainer.tsx`
- `frontend/src/components/email-builder/preview/TemplateRenderer.tsx`

## Modified Files (3)
- `frontend/src/App.tsx` — add 4 routes
- `frontend/src/components/layout/AppSidebar.tsx` — add Email nav item
- `frontend/package.json` — new deps via npm install
