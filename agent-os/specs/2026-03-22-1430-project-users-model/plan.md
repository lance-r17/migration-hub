# Plan: ProjectUsers Model — Project-to-User Mapping

## Context

`ContactsOwnershipDrawer` currently lists all 15 mock users in its Select pickers, regardless of which project is open. The product roadmap calls for role-based access where project team members can only see their own project's data. A `ProjectUsers` model that maps each project to a subset of users is the foundational step.

## Tasks

### Task 1: Add `ProjectUsers` interface to types
**File:** `src/types/index.ts` — add after `User` interface

### Task 2: Add `mockProjectUsers` to mock data
**File:** `src/data/mock.ts` — one entry per project with subsets that include existing contact IDs

### Task 3: Thread `projectId` through component tree
- `src/pages/ProjectDetailsPage.tsx` — add `projectId={project.id}` to `<ApplicationOverviewSection>`
- `src/components/project/ApplicationOverviewSection.tsx` — add `projectId?: string` prop, forward to drawer

### Task 4: Filter users in `ContactsOwnershipDrawer`
**File:** `src/components/drawers/ContactsOwnershipDrawer.tsx`
- Add `projectId: string` to Props
- Derive `availableUsers` from `mockProjectUsers`; fallback to `mockUsers`
- Replace all `mockUsers.map(...)` with `availableUsers.map(...)`

## Verification

1. Open PRJ-2024-ALPHA → Contacts & Ownership edit → only 5 users (u1–u5) appear
2. Open M-11029 → only 4 users (u6–u9) appear
3. Open M-77122 → only 4 users (u9–u12) appear
4. Existing saved contact IDs still resolve correctly in read view
