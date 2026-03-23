# API Service Layer — Full Plan

See `/home/node/.claude/plans/majestic-sleeping-marble.md` for the complete implementation plan.

## Summary

Introduce `src/data/store.ts` (mutable session store), `src/services/` (async service functions with mock/real dual path via `USE_MOCK` flag), and `src/hooks/` (React data-fetching hooks). Refactor all 5 files that import from `@/data/mock` directly to use hooks instead.

## Files Created
- `frontend/src/data/store.ts`
- `frontend/src/services/client.ts`
- `frontend/src/services/projects.ts`
- `frontend/src/services/users.ts`
- `frontend/src/services/dashboard.ts`
- `frontend/src/hooks/use-dashboard.ts`
- `frontend/src/hooks/use-projects.ts`
- `frontend/src/hooks/use-users.ts`
- `frontend/.env.example`

## Files Modified
- `frontend/src/context/UserContext.tsx`
- `frontend/src/components/layout/AppSidebar.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/ProjectDetailsPage.tsx`
- `frontend/src/components/project/ApplicationOverviewSection.tsx`
- `frontend/src/components/drawers/ContactsOwnershipDrawer.tsx`
