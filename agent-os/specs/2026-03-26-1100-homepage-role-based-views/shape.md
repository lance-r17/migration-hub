# Role-Based HomePage Views — Shaping Notes

## Scope

Role-differentiated views on the HomePage:
- **Platform Migration Lead**: Full dashboard — all projects, global stats, all activity
- **All other roles**: "My Projects" — only assigned projects (from mockProjectUsers map), scoped stats, filtered activity

## Decisions

- **Role check**: `user?.role === 'Platform Migration Lead'` is the single gate
- **"Assigned projects"**: determined by `mockProjectUsers` userId mapping in the store
- **Stats for non-leads**: computed from filtered projects (progress, completed, inProgress) via `useMemo` in HomePage
- **Activity filtering**: `projectId` field added to `Activity` type; `useDashboard` accepts optional `projectIds` to filter
- **devPersonas IDs fixed**: Updated from synthetic `dev-persona-*` to real user IDs (`u1`, `u2`, `u3`) so project-user map lookups work during dev switching
- **No new files**: Changes in existing types, store, service, hooks, and page

## Context

- **Visuals:** None
- **References:** WavesPage role guard, AppSidebar role nav filter, existing mockProjectUsers structure
- **Product alignment:** N/A

## Standards Applied

- None (frontend-only, no API surface changes)
