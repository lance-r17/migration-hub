# References

## Similar Implementations

### store.ts
- **Location:** `frontend/src/data/store.ts`
- **Relevance:** Pattern for adding new collection with CRUD methods
- **Key patterns:** structuredClone on init, simple array operations

### use-projects.ts
- **Location:** `frontend/src/hooks/use-projects.ts`
- **Relevance:** Where polling effect is added (useEffect + setInterval)
- **Key patterns:** useCallback saveSection, optimistic updates

### CloudResourcesSection.tsx
- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx`
- **Relevance:** Resource table to extend with Jira Sub-task column and banner
- **Key patterns:** table column pattern, SectionCard wrapper

### services/waves.ts
- **Location:** `frontend/src/services/waves.ts`
- **Relevance:** Mock service pattern with setTimeout delays
