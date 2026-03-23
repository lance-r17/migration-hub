# References for Cloud Resource Access Control

## Similar Implementations

### ContactsOwnershipDrawer — project user lookup
- **Location:** `frontend/src/components/drawers/ContactsOwnershipDrawer.tsx`
- **Relevance:** Uses `useProjectUsers(projectId)` to fetch and filter project members inside a drawer.
- **Key patterns:** Data-fetch inside drawer; `projectId` prop threaded from parent.

### ProjectDetailsPage — role-based UI gating
- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx`
- **Relevance:** Uses `project.approvals.find(a => a.userId === user?.id)` to derive `currentUserRole` and conditionally show the Sign-Off button.
- **Key patterns:** Compute permission flags close to data source, pass as booleans down to child components.

### CloudResourcesSection — onSave gate
- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx`
- **Relevance:** Drawer is only mounted when `onSave` is provided — existing coarse-grained edit guard.
- **Key patterns:** `{onSave && <CloudResourceEditDrawer .../>}` pattern.
