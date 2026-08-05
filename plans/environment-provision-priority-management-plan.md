# Plan: Project Environment Provision Priority Management

## Context
Build a new page that lets the Platform Migration Lead manage project environment-provision priorities. Projects are grouped by the wave they are assigned to and sorted by their environment provision date. Clicking a row opens a right-side panel where the lead can pick a provision date and the environments that need provisioning (DEV, PROD, both). The data is saved as a new `environmentProvision` project section. When a provision date is selected, an immutable **Environment Provision** milestone is rendered on the Wave Gantt Chart above the Data Migration milestone.

## Decisions (from user)
- Build a new page/table component rather than reuse the Gantt chart itself.
- Route: `/waves/environment-provision`; surfaced from `WavesPage` via a **Provisioning** button (like the Gantt/Data Migration buttons).
- Access: platform_migration_lead only.
- Provision status is derived from the selected date and a `completedAt` flag; the completed state is toggled from the panel.
- Environments are stored as a list of selected values (`['dev']`, `['prod']`, or both).
- Projects without a date go to the end of their wave group; projects without a wave appear in an **Unassigned** group.
- No separate section on the Project Details page; the saved data is surfaced only as an immutable milestone on the Wave Gantt Chart.

## Proposed approach

### Backend
1. Add a new `environment_provision` JSONB column to `projects`.
2. Create an Alembic migration to add the column.
3. Expose the section through the existing section-update pipeline (`SECTION_COLUMN_MAP`/`SECTION_LABELS`).
4. Include `environment_provision` in the `ProjectListItem`, `ProjectHomeItem`, and `ProjectDetail` schemas, and return it in the `basic` field subset so it is fetched with normal list requests.

### Frontend types & services
1. Add `EnvironmentProvision` type and `getEnvironmentProvisionStatus` helper to `frontend/src/types/index.ts`.
2. Add `environmentProvision` to the `Project` interface.
3. Map the `environment_provision` API field in `frontend/src/services/projects.ts` and add a small `updateEnvironmentProvision` helper.
4. Add example provision data to a few mock projects in `frontend/src/data/mock.ts`.

### New page: `EnvironmentProvisionPage`
- Reuse the full-height header/content layout from `WaveGanttPage.tsx`.
- Fetch waves and projects (`fields: ['basic']`).
- Group projects by `waveId`; collect waveless projects into an **Unassigned** group.
- Sort each group by `environmentProvision.date` ascending; projects without a date fall to the end of the group, sorted by name.
- Render a Shadcn `Table` with columns: Name, Project ID, New Project ID, Migration Strategy, Environment Provision Date, Provision Status.
- Row click opens a Shadcn `Sheet` from the right.
- Sheet contents:
  - Project header.
  - Inline `Calendar` (`mode="single"`) for the provision date.
  - Environment checkboxes: DEV, PROD, both.
  - Derived status badge.
  - **Mark as completed** / **Reopen** button (writes `completedAt`).
  - **Save** button that persists `date`, `environments`, and `completedAt` via `updateProject('environmentProvision', …)`.
- Optimistic local update with server revert on failure; toast on success/error.

### Navigation
- Add the new route in `frontend/src/App.tsx` under `/waves/environment-provision`.
- Add a **Provisioning** button to `WavesPage.tsx` (next to Gantt / Data Migration) that navigates to the new route.

### Wave Gantt Chart integration
- In `WaveGanttChart.tsx`, remove the **Environment Provision Stage** preset from the milestone-creation option list (`MILESTONE_PRESETS`), because the provision milestone is now exclusively owned by the new Environment Provision section.
- Compute the frozen `Environment Provision` milestone from `project.environmentProvision.date` and reuse the same icon (CloudUpload) that the removed preset used.
- Status: `done` if `completedAt`; `in-progress` if the date is today or earlier; otherwise `todo`.
- Place it at the top of the milestone list for each project, above the Data Migration period milestone.
- Mark it as `immutable: true` so it cannot be dragged, resized, edited, deleted, or connected.
- Update all immutability checks in the chart (drag, resize, connector, status menu, delete menu, cursor) to also respect `milestone.immutable`.

## Files to modify
- `backend/app/models/project.py`
- `backend/app/schemas/project.py`
- `backend/app/services/project_service.py`
- `backend/app/routers/projects.py` (schema wiring only, no new endpoint)
- `backend/alembic/versions/00XX_add_environment_provision.py`
- `frontend/src/types/index.ts`
- `frontend/src/services/projects.ts`
- `frontend/src/data/mock.ts`
- `frontend/src/pages/WavesPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/waves/WaveGanttChart.tsx`
- `frontend/src/pages/EnvironmentProvisionPage.tsx` (new)

## Reuse
- `useWaves` / `useProjects` hooks for data loading.
- `updateProject` service for section updates.
- Shadcn `Table`, `Sheet`, `Calendar`, `Checkbox`, `Button`, `Badge`, `Select` components.
- Layout pattern from `WaveGanttPage.tsx`.
- Gantt chart milestone rendering and status logic for the Environment Provision milestone.

## Implementation steps
- [ ] Backend: model, migration, schemas, service mappings.
- [ ] Frontend types and API mapping.
- [ ] Frontend mock data.
- [ ] Build `EnvironmentProvisionPage` with grouped table, sorting, and edit sheet.
- [ ] Add route and navigation button.
- [ ] Inject immutable Environment Provision milestone into `WaveGanttChart` and guard against edits.
- [ ] Verification: backend tests, frontend build, manual UI checks.

## Verification
1. Run `pytest` in the backend to confirm migration and schema changes pass.
2. Run `pnpm run build` in the frontend to confirm TypeScript and Vite build cleanly.
3. Manual checks:
   - From `WavesPage`, click **Provisioning** → land on `/waves/environment-provision`.
   - Confirm projects are grouped by wave, sorted by provision date, and unassigned projects appear in an Unassigned group.
   - Click a project row, set a date and select DEV/PROD, save, then verify the row updates and the status badge changes.
   - Mark a project as completed; verify the status badge shows **Completed** and the `completedAt` value is saved.
   - Open the Wave Gantt Chart and confirm an immutable **Environment Provision** milestone appears on the selected date above the Data Migration milestone.
   - Confirm non-lead users cannot access the new page (route blocks access).
