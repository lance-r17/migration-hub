# Role-Based HomePage Views — Plan

## Context

HomePage shows everything to everyone. This makes it irrelevant for non-platform-lead users who only care about their own projects. This feature adds role branching so platform leads see the global dashboard and others see a scoped "My Projects" view.

## Files Modified

- `frontend/src/types/index.ts` — add `projectId?` to Activity
- `frontend/src/data/mock.ts` — fix devPersonas IDs; add projectId to recentActivity
- `frontend/src/data/store.ts` — add `getProjectsForUser(userId)`
- `frontend/src/services/projects.ts` — add `getProjectsForUser(userId)` service
- `frontend/src/hooks/use-projects.ts` — role-based fetch in `useProjects()`
- `frontend/src/hooks/use-dashboard.ts` — accept optional projectIds, filter activity
- `frontend/src/pages/HomePage.tsx` — role-aware rendering

## Tasks

1. Add `projectId?` to Activity type and update mock recentActivity with project IDs
2. Fix devPersonas IDs (u1/u2/u3), add store/service methods for user-filtered projects
3. Update useProjects to role-branch on fetch, re-fetch on user change
4. Update useDashboard to accept and apply projectIds filter
5. Update HomePage with role-aware title, stats, section labels, and action buttons
