# References for Projects Listing Page

## Similar Implementations

### WavesPage

- **Location:** `frontend/src/pages/WavesPage.tsx`
- **Relevance:** Full page table view with AppShell, loading skeletons, empty state, row actions, and navigation
- **Key patterns:**
  - Import `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`
  - Use `AppShell` wrapper
  - Show `<Skeleton>` rows while loading
  - Show empty state text when array is empty
  - Row click handlers for navigation

### SettingsPage

- **Location:** `frontend/src/pages/SettingsPage.tsx`
- **Relevance:** Role-gated page that shows lock screen for non-authorized users
- **Key patterns:**
  - Early return with lock UI if `!user?.role.includes('platform_migration_lead')`
  - `useNavigate` for redirect button
  - `Lock` icon from lucide-react

### EmbargoSection

- **Location:** `frontend/src/components/settings/EmbargoSection.tsx`
- **Relevance:** Table usage within a section component
- **Key patterns:**
  - Styled `TableHeader` with `bg-muted/50` and uppercase tracking
  - `TableCell` with `font-medium` for primary data
  - Action buttons in last `TableCell`

### HomePage

- **Location:** `frontend/src/pages/HomePage.tsx`
- **Relevance:** Current project grid implementation; source for role-check pattern and project card rendering
- **Key patterns:**
  - `const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false`
  - `sortedProjects` mapping to `ProjectCard`
  - `useProjects` hook usage

### AppSidebar

- **Location:** `frontend/src/components/layout/AppSidebar.tsx`
- **Relevance:** Navigation structure with role-based filtering
- **Key patterns:**
  - `requiresRole` field on nav items
  - Filter with `user?.role.includes(item.requiresRole)`
