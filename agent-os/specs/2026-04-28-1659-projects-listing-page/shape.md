# Projects Listing Page — Shaping Notes

## Scope

- Modify HomePage project grid for platform migration leads: show only the 5 most recently active project cards plus a "View All Projects" card.
- Create a new `/projects` page that lists all projects in a table.
- The projects page and its navigation are only visible/accessible to platform migration leads.

## Decisions

- **"Latest 5 active" sorting**: Use `updatedAt` descending to determine "latest". If `updatedAt` is missing, fall back to the existing sort order (progress/status). Only show projects with status !== 'completed' for the 5-card slice (active projects). If fewer than 5 active projects exist, show all active + pad with most recently updated completed ones to reach 5, or just show whatever is available.
  - *Simpler approach*: Keep existing `sortedProjects` order but slice to 5. The user said "latest 5 active" — given the current sort is by progress/status, I'll filter to non-completed first, sort by `updatedAt` desc, take 5. If less than 5, fill with remaining projects sorted by `updatedAt`.
  - *Even simpler*: Just slice `sortedProjects` to 5. The existing sort is reasonable and "active" is already somewhat represented. Let's go with filtering out `completed` status, sorting by `updatedAt` desc, taking up to 5. If <5 active, just show what's there (don't pad with completed).
- **"View All Projects" card styling**: Use a distinct but consistent card style — muted background, centered text with a folder icon, hover state. It should match the grid cell size of `ProjectCard`.
- **Projects table columns**: Name, ID, Status, Progress (%), Wave, Profile Owner, Team (avatars), Actions ("View" link).
- **Role gating**: Reuse the `SettingsPage` lock-screen pattern for non-leads trying to access `/projects` directly.
- **Navigation placement**: Add "Projects" as the second item in the main nav, right after "Dashboard".

## Context

- **Visuals:** None provided
- **References:** 
  - `WavesPage.tsx` — table page pattern with AppShell, loading states, empty state
  - `SettingsPage.tsx` — role-gate redirect pattern
  - `EmbargoSection.tsx` — shadcn/ui Table usage example
- **Product alignment:** Aligns with roadmap Phase 2 "Migration progress dashboard" and the existing role-based views already implemented in HomePage.

## Standards Applied

- N/A — no `agent-os/standards/` folder exists
