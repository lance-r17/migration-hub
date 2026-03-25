# References for Wave Planning

## Similar Implementations

### SectionEditDrawer pattern
- **Location:** `frontend/src/components/drawers/SectionEditDrawer.tsx`
- **Relevance:** All wave drawers (Create, Import, Assign) use this as the wrapper shell
- **Key patterns:** Sheet/SheetContent with 480px width, Save/Cancel footer, children slot for form content

### SignOffModal
- **Location:** `frontend/src/components/modals/SignOffModal.tsx`
- **Relevance:** The 2-step sign-off enhancement (step 2 = Jira sub-task config) is built on top of this
- **Key patterns:** Two-panel layout (ApprovalTimeline left, form right), local state for form fields

### useProject / saveSection pattern
- **Location:** `frontend/src/hooks/use-projects.ts`
- **Relevance:** Wave assignment (`waveId`) and Jira config (`jiraSubtaskConfig`) use the same saveSection + audit pattern
- **Key patterns:** Optimistic update → API call → audit entry generation

### projects.ts service
- **Location:** `frontend/src/services/projects.ts`
- **Relevance:** waves.ts follows the same dual-mode (mock/real) pattern
- **Key patterns:** USE_MOCK toggle, delay() for mock simulation, ENDPOINTS constant

### store.ts
- **Location:** `frontend/src/data/store.ts`
- **Relevance:** _waves collection follows exact same pattern as _projects
- **Key patterns:** structuredClone of mock data, CRUD methods on store object

### AuditLogTimeline EVENT_CONFIG
- **Location:** `frontend/src/components/audit/AuditLogTimeline.tsx`
- **Relevance:** 4 new event types added to the existing Record<AuditEventType, ...> config

### AppSidebar navMain
- **Location:** `frontend/src/components/layout/AppSidebar.tsx`
- **Relevance:** Waves nav item added with requiresRole filter for Platform Migration Lead
