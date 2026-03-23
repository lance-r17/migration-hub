# ProjectUsers Model — Shaping Notes

## Scope

Introduce a `ProjectUsers` model that maps each project to a subset of users from the global `mockUsers` directory. Update `ContactsOwnershipDrawer` to only show users associated with the current project in its Select pickers.

## Decisions

- `ProjectUsers` is a separate interface (not embedded in `Project`) to reflect its role as a join/mapping entity
- Thread `projectId` as a prop: `ProjectDetailsPage` → `ApplicationOverviewSection` → `ContactsOwnershipDrawer`; the drawer resolves available users internally from `mockProjectUsers`
- Fallback to all users if no mapping is found for a project (safe degradation)
- Mock data assigns overlapping user subsets per project; existing contact IDs remain valid

## Context

- **Visuals:** None
- **References:** `ContactsOwnershipDrawer.tsx`, `ApplicationOverviewSection.tsx`, `ProjectDetailsPage.tsx`, `src/data/mock.ts`, `src/types/index.ts`
- **Product alignment:** Supports Phase 1 role-based access control — project members should only interact with their own project's data

## Standards Applied

- Frontend-only change; no API or database standards apply (mock data only at this stage)
