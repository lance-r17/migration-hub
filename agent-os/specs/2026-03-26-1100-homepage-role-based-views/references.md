# References for Role-Based HomePage Views

## Similar Implementations

### WavesPage role guard
- **Location:** `frontend/src/pages/WavesPage.tsx` lines 49–65
- **Relevance:** Existing pattern for `user?.role === 'Platform Migration Lead'` access check
- **Key patterns:** Single role check at top of component, early return with access-denied UI

### AppSidebar role-based nav
- **Location:** `frontend/src/components/layout/AppSidebar.tsx`
- **Relevance:** Filters nav items based on `user.role` — same role the HomePage will branch on
- **Key patterns:** Derives visible items from role on each render

### mockProjectUsers mapping
- **Location:** `frontend/src/data/mock.ts` lines 23–62
- **Relevance:** The data structure used to determine "which projects belong to which user"
- **Key patterns:** `{ projectId, userIds[] }` array; filter by userId to find assigned project IDs

### store.getProjectUsers
- **Location:** `frontend/src/data/store.ts` lines 97–103
- **Relevance:** Precedent for querying the project-user map; `getProjectsForUser` is the inverse operation
- **Key patterns:** `.find()` on `_projectUserMap`, maps to User objects
