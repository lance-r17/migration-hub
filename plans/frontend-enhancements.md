# Frontend Enhancements Plan

## Context
Six targeted UI/UX changes across the React frontend, mostly around naming, role handling, filtering, and the sign-off workflow.

## Files to Modify

1. `frontend/src/components/waves/WaveGanttChart.tsx` — milestone presets & auto-generated milestone labels
2. `frontend/src/components/email-builder/builder/right-panel/ConfigTab.tsx` — recipient role dropdown
3. `frontend/src/pages/BgiCloudLeadsPage.tsx` + `frontend/src/services/adminUsers.ts` — delete → role removal
4. `frontend/src/pages/ProjectsPage.tsx` — project search filter
5. `frontend/src/types/settings.ts` + `frontend/src/services/migrationSettings.ts` + `frontend/src/data/store.ts` + `frontend/src/pages/MigrationSettingsPage.tsx` + `frontend/src/pages/ProjectDetailsPage.tsx` + `frontend/src/components/modals/SignOffModal.tsx` — Jira creation toggle
6. `frontend/src/lib/approvals.ts` + `frontend/src/pages/ProjectDetailsPage.tsx` + `frontend/src/components/modals/SignOffModal.tsx` + `frontend/src/components/modals/ApprovalTimeline.tsx` + `frontend/src/components/project/SignOffWorkflowBar.tsx` + `frontend/src/components/project/StageProgressStepper.tsx` — sign-off role sequence

## Reuse
- `useMigrationSettings` / `MigrationSettingsContext` for the new Jira toggle.
- `updateAdminUser` for stripping the `bgi_cloud_lead` role without deleting the user.
- Existing `getSignoffConfig` and sign-off state already in `ProjectDetailsPage`.
- Governance role data (`project.governanceRoles.gbiChampion` / `gbiChampionDelegate`) is already loaded via `useProject`.

## Steps

### 1. Rename Gantt milestone labels
- [ ] In `WaveGanttChart.tsx`, change `MILESTONE_PRESETS` entry for `dev-cutover` from `"DEV Cutover"` → `"DEV Testing Cutover"`.
- [ ] In the `buildDataMigrationPeriodMilestone` function, change the generated milestone `name` from `"Data Migration"` → `"Data Migration (Prod)"`.

### 2. Add BGI Champion recipient roles to email templates
- [ ] In `ConfigTab.tsx`, append `gbi_champion` and `gbi_champion_delegate` to `RECIPIENT_ROLES` and `ROLE_LABELS` with the labels **"BGI Champion"** and **"BGI Champion Delegate"**.

### 3. BGI Cloud Leads delete should remove role, not user
- [ ] Import `updateAdminUser` into `BgiCloudLeadsPage.tsx`.
- [ ] Replace `deleteBgiCloudLead(deleteTarget.id)` with `updateAdminUser(deleteTarget.id, { role: deleteTarget.role.filter(r => r !== 'bgi_cloud_lead').join(', ') })`.
- [ ] Update the confirmation dialog title/description/button from "Delete User" to "Remove BGI Cloud Lead Role".
- [ ] Toast message: `"BGI Cloud Lead role removed"`.

### 4. Enhance Projects search by application name and BA ID
- [ ] In `ProjectsPage.tsx`, extend the `filteredProjects` `query` check to also match:
  - `p.applicationOverview?.applicationName`
  - `p.applicationOverview?.baId`
- [ ] Update the search input placeholder to indicate the extra fields.

### 5. Toggle Jira story/sub-task creation on sign-off
- [ ] Add `createJiraStoriesOnSignoff?: boolean` to `MigrationSettings` (default `true`).
- [ ] Update `DEFAULTS` in `MigrationSettingsPage.tsx` and the mock store in `data/store.ts`.
- [ ] Update `services/migrationSettings.ts` `toApi` / `fromApi` mapping for the new field.
- [ ] In `MigrationSettingsPage.tsx` "Platform Migration" card, add a switch labeled **"Create Jira stories/sub-tasks on sign-off"** bound to the new flag.
- [ ] In `ProjectDetailsPage.tsx`, read `migrationSettings?.createJiraStoriesOnSignoff`.
- [ ] Pass a `jiraCreationEnabled` prop to `SignOffModal`.
- [ ] In `SignOffModal.tsx`, when `isPlatformLead && !jiraCreationEnabled`, bypass Step 2 and call `onConfirm` directly.
- [ ] Guard `handleConfirmWithJira` so it only runs when the toggle is enabled.

### 6. Change 2nd approver from Business Owner to BGI Champion / Delegate
- [ ] Introduce `getProjectApprovalSequence(project)` in `lib/approvals.ts` that returns `['technical_lead', <gbi role>, 'platform_migration_lead']` where the GBI role is the assigned BGI Champion or BGI Champion Delegate for the project.
- [ ] Update `ensureAllRoles(approvals, expectedRoles)` to accept the expected sequence, defaulting to a sensible global sequence.
- [ ] In `ProjectDetailsPage.tsx`:
  - replace local `APPROVAL_SEQUENCE` with the project-specific sequence,
  - update `currentUserRole` to include `gbi_champion` / `gbi_champion_delegate` assignments,
  - update predecessor checks so that the GBI step is satisfied when either assigned GBI role has approved.
- [ ] In `SignOffModal.tsx`, add `gbi_champion` and `gbi_champion_delegate` to the `roles` display list with the labels **"BGI Champion"** and **"BGI Champion Delegate"**.
- [ ] In `ApprovalTimeline.tsx`, `SignOffWorkflowBar.tsx`, and `StageProgressStepper.tsx`, add labels/icons for the BGI roles and make the "3 approvals" copy dynamic where needed.

## Verification
- Run the dev server and verify each page change manually:
  - Wave Gantt add-milestone dropdown shows "DEV Testing Cutover" and the auto Data Migration row reads "Data Migration (Prod)".
  - Email template editor role dropdown lists BGI Champion / Delegate.
  - Deleting a BGI Cloud Lead removes the user from the table but the user still exists in User Accounts.
  - Projects search filters by app name and BA ID.
  - Migration Settings switch persists and disables the Jira step for Platform Migration Lead sign-off.
  - Project sign-off workflow requires Technical Lead → BGI Champion/Delegate → Platform Migration Lead.

### 7. Rename user-facing "GBI Champion" labels to "BGI Champion"
- [ ] Do a global find-and-replace of user-visible strings:
  - `"GBI Champion"` → `"BGI Champion"`
  - `"GBI Champion Delegate"` → `"BGI Champion Delegate"`
- [ ] Keep the internal role keys (`gbi_champion` / `gbi_champion_delegate`) and variable names unchanged to avoid breaking the API.
- [ ] Files likely touched include:
  - `pages/UserAccountsPage.tsx`
  - `components/email-builder/builder/right-panel/ConfigTab.tsx`
  - `components/project/ApplicationOverviewSection.tsx`
  - `pages/ProjectsPage.tsx`
  - `lib/noteTemplateUtils.ts`
  - `lib/export-report.ts`
  - `components/modals/ApprovalTimeline.tsx`
  - `components/project/SignOffWorkflowBar.tsx`
  - `components/project/StageProgressStepper.tsx`

## Notes / Decisions

1. **Data Migration rename scope** — Only the auto-generated milestone label in `WaveGanttChart.tsx` will be changed to "Data Migration (Prod)".
2. **Jira toggle behavior** — When the switch is off, the Platform Migration Lead will skip the Jira configuration step and only record the approval.
3. **BGI Champion vs Delegate** — Either assigned role can independently approve the 2nd step. If both are assigned, only one approval is required.
4. **Business Owner** — The Business Owner governance contact remains assignable and visible in Contacts & Ownership; it is simply no longer part of the sign-off sequence.
5. **GBI → BGI rename** — Only human-readable labels are updated; backend role keys remain `gbi_champion` / `gbi_champion_delegate`.
