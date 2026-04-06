# References for Email Builder

## Similar Implementations

### Wave Planning Page
- **Location:** `frontend/src/pages/WavesPage.tsx`, `frontend/src/components/drawers/CreateWaveDrawer.tsx`
- **Relevance:** Role-gated page (Platform Migration Lead), toast-on-save pattern, drawer form with date pickers
- **Key patterns:** `requiresRole` nav filter, `useWaves()` hook pattern, `WaveStatusBadge` component

### Finance Page
- **Location:** `frontend/src/pages/FinancePage.tsx`
- **Relevance:** Complex full-page layout with multiple panels, CSV data handling, comparison drawers
- **Key patterns:** Local state for selected data, `useBillingData()` hook, Skeleton loading states

### Survey Builder
- **Location:** `frontend/src/pages/SurveyBuilderPage.tsx`, `frontend/src/components/settings/SurveyBuilderSection.tsx`
- **Relevance:** Settings sub-page for Platform Lead, form with reorderable items
- **Key patterns:** Breadcrumb navigation, controlled form state

### Section Edit Drawers
- **Location:** `frontend/src/components/drawers/ApplicationProfileDrawer.tsx`
- **Relevance:** Drawer-based forms with draft state, save/cancel pattern
- **Key patterns:** `SectionEditDrawer` wrapper, setter factory `set(field)`, `useEffect` to sync on open

### Sign-Off Modal
- **Location:** `frontend/src/components/modals/SignOffModal.tsx`
- **Relevance:** Multi-step modal with approval flow, ToggleGroup for mode selection
- **Key patterns:** `step` state, conditional step rendering, `ApprovalTimeline`

## Key Type Files

- `frontend/src/types/index.ts` — Project, User, Wave, Risk, Approval, CloudResource
- `frontend/src/types/audit.ts` — AuditEventType, AuditLogEntry
- `frontend/src/types/wave.ts` — Wave, WaveStatus, JiraSubtaskConfig

## Service/Hook Patterns

- `frontend/src/services/billing.ts` — clean mock/real dual path pattern
- `frontend/src/services/client.ts` — `USE_MOCK` toggle, `apiClient` abstraction
- `frontend/src/hooks/use-waves.ts` — data hook with optimistic updates
