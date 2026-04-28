# Projects Listing Page — Plan

## Context

The HomePage currently shows all projects in a card grid for platform migration leads. As the project count grows, this becomes unwieldy. We need to:
1. Limit the HomePage project grid to the 5 most recently active projects for platform leads
2. Provide a "View All Projects" card that navigates to a dedicated projects listing page
3. Create that projects page as a table view, restricted to platform migration leads only

## Approach

- **HomePage**: Slice `sortedProjects` to first 5 for platform leads, then render a 6th "View All Projects" card. Non-platform leads continue seeing all their assigned projects.
- **ProjectsPage**: New page using the existing `useProjects` hook and shadcn/ui `Table` component. Display key project fields in sortable columns. Include role-gate redirect like `SettingsPage`.
- **Routing**: Add `/projects` route in `App.tsx` under `ProtectedRoute`.
- **Navigation**: Add "Projects" sidebar item gated to `platform_migration_lead`.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/pages/ProjectsPage.tsx` | **New** — full projects table page |
| `frontend/src/App.tsx` | Add `/projects` route |
| `frontend/src/pages/HomePage.tsx` | Limit platform lead grid to 5 cards + "View All" card |
| `frontend/src/components/layout/AppSidebar.tsx` | Add Projects nav item for platform leads |

## Reuse

- **Table components**: `frontend/src/components/ui/table.tsx` — shadcn/ui table primitives (used in `WavesPage`, `EmbargoSection`)
- **AppShell**: `frontend/src/components/layout/AppShell.tsx` — consistent page wrapper
- **useProjects hook**: `frontend/src/hooks/use-projects.ts` — fetches all projects (already role-aware on backend/mock)
- **useCurrentUser**: `frontend/src/context/UserContext.tsx` — role check pattern
- **StatusBadge**: `frontend/src/components/shared/StatusBadge.tsx` — renders project status with stage progress
- **ProgressBar**: `frontend/src/components/shared/ProgressBar.tsx` — renders migration progress
- **Role-gate pattern**: `frontend/src/pages/SettingsPage.tsx` — redirect non-leads with lock screen
- **TeamAvatars**: `frontend/src/components/shared/TeamAvatars.tsx` — render team members in table

## Steps

- [ ] **Step 1**: Create `ProjectsPage.tsx`
  - Use `AppShell` wrapper
  - Use `useProjects` + `useCurrentUser` hooks
  - Role-gate: redirect non-`platform_migration_lead` users to `/` with lock screen (reuse SettingsPage pattern)
  - Render table with columns: Name, ID, Status, Progress, Wave, Profile Owner, Team, Actions
  - Clicking a row navigates to `/projects/:id`
  - Show loading skeletons while `loading` is true
  - Show empty state when no projects
- [ ] **Step 2**: Update `App.tsx`
  - Add `<Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />`
- [ ] **Step 3**: Update `HomePage.tsx`
  - For `isPlatformLead`: slice `sortedProjects` to first 5
  - Add a 6th card "View All Projects" that navigates to `/projects` on click
  - Non-platform leads: unchanged (show all assigned projects)
- [ ] **Step 4**: Update `AppSidebar.tsx`
  - Add `{ title: "Projects", url: "/projects", icon: <FolderOpen />, requiresRole: "platform_migration_lead" }` after Dashboard
  - Import `FolderOpen` from lucide-react
- [ ] **Step 5**: Verification
  - Run `npm run dev` or build to check for TypeScript errors
  - Manual test: login as platform lead → see 5 project cards + View All on HomePage → click View All → land on Projects table page → click row → navigate to project details
  - Manual test: login as non-lead → HomePage shows all assigned projects, no View All card, no Projects sidebar item, `/projects` redirects to `/`

## Verification

1. `cd frontend && npx tsc --noEmit` passes without errors
2. HomePage for platform lead shows exactly 5 project cards + 1 "View All Projects" card
3. Clicking "View All Projects" navigates to `/projects`
4. `/projects` displays all projects in a table with columns: Name, ID, Status, Progress, Wave, Profile Owner, Team, Actions
5. `/projects` sidebar nav item visible only for platform leads
6. Non-lead users accessing `/projects` are redirected to HomePage
