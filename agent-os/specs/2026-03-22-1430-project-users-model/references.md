# References for ProjectUsers Model

## Similar Implementations

### ContactsOwnershipDrawer

- **Location:** `src/components/drawers/ContactsOwnershipDrawer.tsx`
- **Relevance:** The target file; currently imports `mockUsers` directly and maps all users to Select items
- **Key patterns:** `mockUsers.find(u => u.id === userId)` for UserPreview; will be replaced with `availableUsers.map(...)`

### ApplicationOverviewSection

- **Location:** `src/components/project/ApplicationOverviewSection.tsx`
- **Relevance:** Intermediary that mounts ContactsOwnershipDrawer; needs `projectId` prop added and forwarded

### ProjectDetailsPage

- **Location:** `src/pages/ProjectDetailsPage.tsx`
- **Relevance:** Source of `project.id`; passes props to ApplicationOverviewSection

### mockUsers / mock data

- **Location:** `src/data/mock.ts`
- **Relevance:** Global user directory (15 users u1–u15); `mockProjectUsers` will be added here alongside it
