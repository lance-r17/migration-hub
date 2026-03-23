# Plan: Apply shadcn Layout & Styles to frontend/

See the full plan at `/home/node/.claude/plans/effervescent-wiggling-journal.md`.

## Summary

Full migration of `frontend/` to the shadcn stack:
- Tailwind CSS v3 → v4 (OKLch neutral palette)
- Hand-rolled layout → shadcn collapsible sidebar (AppSidebar + SiteHeader)
- Hand-rolled shared components → shadcn/ui primitives (22 components)
- Custom Toast → sonner
- Inter font → Geist Variable

## Tasks

1. Save spec documentation
2. Dependency surgery (npm install/uninstall)
3. Build config + CSS migration
4. Copy shadcn/ui primitives and hooks
5. New layout shell (AppSidebar, SiteHeader, AppShell)
6. Wire up main.tsx and App.tsx
7. Migrate shared components
8. Migrate all page components
9. Verify build and check for orphaned tokens
