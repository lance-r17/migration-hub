# References for API Service Layer

## Similar Implementations

### Mock data source
- **Location:** `frontend/src/data/mock.ts`
- **Relevance:** All mock data exports; the store wraps these with `structuredClone`
- **Key patterns:** `mockProjects`, `mockUsers`, `mockProjectUsers`, `overallStats`, `recentActivity`, `mockCurrentUser`

### UserContext
- **Location:** `frontend/src/context/UserContext.tsx`
- **Relevance:** Existing pattern for providing user data via React context; being extended to async init

### ProjectDetailsPage handleSave
- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx` line 40
- **Relevance:** The `<K extends keyof Project>(key: K, value: Project[K])` generic signature is preserved exactly in `saveSection` and `store.updateProject`
