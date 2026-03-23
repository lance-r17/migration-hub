# References for Audit Log — Change History

## Similar Implementations

### ActivityTimeline (Dashboard)

- **Location:** `frontend/src/components/home/ActivityTimeline.tsx`
- **Relevance:** Existing timeline UI showing system-wide activity entries
- **Key patterns:** Entry list with icon, message, time, actor. Good reference for visual style.

### ApprovalTimeline (Sign-off Modal)

- **Location:** `frontend/src/components/modals/ApprovalTimeline.tsx`
- **Relevance:** Per-project timeline showing who approved and when
- **Key patterns:** Role-based entries with timestamps, status icons

### Existing Drawers

- **Location:** `frontend/src/components/drawers/` (24 components)
- **Relevance:** All use shadcn Sheet with consistent header/close patterns
- **Key patterns:** `open`, `onClose` props; Sheet + SheetContent + SheetHeader structure

### useProject Hook

- **Location:** `frontend/src/hooks/use-projects.ts`
- **Relevance:** Primary interception point — has `previous = project` snapshot before optimistic update
- **Key patterns:** `saveSection<K>(key, value)` generic; `updateProject` call after optimistic set

### Mock Store

- **Location:** `frontend/src/data/store.ts`
- **Relevance:** In-memory session store pattern; audit log map follows same approach
- **Key patterns:** `let _x = structuredClone(mockX)` initialization; typed CRUD methods on `store` object

### Service Layer

- **Location:** `frontend/src/services/projects.ts`
- **Relevance:** USE_MOCK guard pattern for mock vs real API calls
- **Key patterns:** `if (USE_MOCK) { await delay(); return store.X() }` then real API call
