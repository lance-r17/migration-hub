# References for Frontend E2E Playwright

## Auth & Routing

### UserContext.tsx
- **Location:** `frontend/src/context/UserContext.tsx`
- **Relevance:** Auth persistence key is `AUTH_KEY = 'auth'` stored in `sessionStorage`
- **Key patterns:** Set `sessionStorage.setItem('auth', 'true')` before navigation to bypass login

### App.tsx
- **Location:** `frontend/src/App.tsx`
- **Relevance:** Defines all routes and `ProtectedRoute` wrapper
- **Key patterns:** `/login` is public; `/`, `/projects/:id`, `/waves` are protected

## Pages

### ProjectDetailsPage.tsx
- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx`
- **Relevance:** Sign-off button, breadcrumb, wave assignment, audit log trigger
- **Key patterns:** "Sign-off" button only visible when `canSignOff` is true (project status is planning/in-progress/blocked and approval not yet approved)

### WavesPage.tsx
- **Location:** `frontend/src/pages/WavesPage.tsx`
- **Relevance:** Wave table, Create/Import buttons, role-gating
- **Key patterns:** Shows "Access Restricted" for non-Platform Migration Lead

## Drawers & Modals

### CreateWaveDrawer.tsx
- **Location:** `frontend/src/components/drawers/CreateWaveDrawer.tsx`
- **Relevance:** Wave creation form — name input (placeholder: "Wave 5 – Q1 2027"), date range picker, description
- **Key patterns:** Uses `Sheet` (renders as `role="dialog"`), submit button text is "Create Wave"

### SignOffModal.tsx
- **Location:** `frontend/src/components/modals/SignOffModal.tsx`
- **Relevance:** 2-step sign-off for Platform Migration Lead
- **Key patterns:** Step 1 title: "Authority Sign-off", checkbox id="ack", button text: "Next: Configure Jira"; Step 2 title: "Configure Jira Sub-tasks"

### CloudResourcesSection.tsx
- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx`
- **Relevance:** Resource table with clickable rows that open `CloudResourceEditDrawer`
- **Key patterns:** Click a `<tr>` row to open edit drawer

## Mock Data

### mock.ts
- **Location:** `frontend/src/data/mock.ts`
- **Relevance:** Source of truth for test data; 4 projects, 3 waves, 15 users
- **Key mock user:** `id: 'u-current'`, `role: 'Platform Migration Lead'`
