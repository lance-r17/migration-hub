# Component Inventory

All components live in `frontend/src/components/`. The hierarchy is:

```
components/
├── ui/          shadcn/ui primitives (never modified directly)
├── layout/      App shell, sidebar, navigation
├── shared/      Reusable cross-page components
├── home/        Home page widgets
├── project/     Project section display components
├── drawers/     Right-side edit panels
├── modals/      Modal dialogs
└── audit/       Audit log display
```

---

## Layout

### `AppShell`
The root layout wrapper. Provides the `SidebarProvider`, renders `AppSidebar` on the left and a main content area on the right.

### `AppSidebar`
Collapsible sidebar. Contains the app logo, `NavMain` (primary nav), and `NavSecondary` (secondary links).

### `SiteHeader`
Top navigation bar. Contains the sidebar trigger and breadcrumb.

### `NavMain`
Primary navigation links (Dashboard, Projects, Waves, Finance, Email, Settings, Admin).

### `NavSecondary`
Secondary navigation links (Settings, Help).

### `NavUser`
User profile dropdown in the sidebar footer — shows avatar, name, email, and a logout option.

---

## Shared

### `SectionCard`
```tsx
<SectionCard icon={<Icon />} title="Section Name" onEdit={() => setOpen(true)}>
  {/* section content */}
</SectionCard>
```
Card with an icon-header row and an optional edit button. All project section components are wrapped in `SectionCard`.

### `MotionCard`
Wrapper that adds an entrance animation (using `motion`) to any card-like content.

### `StatusBadge`
```tsx
<StatusBadge status="in-progress" />
```
Renders a colour-coded badge for `ProjectStatus` values.

### `TeamAvatars`
```tsx
<TeamAvatars members={project.team} />
```
Renders a row of overlapping avatars for team members.

### `Logo`
SVG logo component used in the sidebar and login page.

---

## Home page

### `OverallProgressCard`
Displays the overall migration progress percentage and asset count.

### `StatCard`
```tsx
<StatCard label="Completed" value={14} icon={<CheckIcon />} />
```
A metric tile used in the home page stats row.

### `ProjectCard`
Displays a single project summary card — name, status badge, progress bar, team avatars, wave label, and a link to the project details page.

### `ActivityTimeline`
Renders a scrollable list of `Activity` entries. Each entry has a type icon (success/info/error), message, actor, and relative time.

### `SecurityHealthWidget`
Shows a summary security health indicator on the home page.

### `ProjectStatusChartCard`
A tabbed overview card on the home page with four tabs: **Stages**, **Surveys**, **Engagement**, and **Assets**.

- **Surveys tab** displays a two-page carousel:
  1. **Application Survey** — Submitted / Draft / Not Submitted.
  2. **Data Migration Survey** — Submitted / Not Submitted.
- A vertical dot navigation on the right switches between the two survey statistics without changing the tab content height.

---

## Project sections

Each section component follows the same interface pattern:

```tsx
interface SectionProps {
  data: SectionType                    // the current section data
  onSave: (updated: SectionType) => void  // called when the drawer saves
  allUsers?: User[]                    // for people-picker sections
}
```

| Component | Section | Key data |
|---|---|---|
| `ApplicationOverviewSection` | Application Overview | App name, tier, EIM ID, owner contacts |
| `CloudResourcesSection` | Current Infrastructure | Cloud resources by category, network config |
| `AvailabilitySection` | Availability & Resilience | RTO, RPO, SLA, AZ patterns |
| `DataSecuritySection` | Data & Persistence | DB types, encryption, PII, compliance |
| `DependenciesSection` | Dependencies | Upstream/downstream services, TLS certs, API keys |
| `NonFunctionalRequirementsSection` | Non-Functional Requirements | Peak load, autoscaling, monitoring |
| `MigrationCutoverSection` | Migration Constraints | Migration windows, blackout dates, rollback plan, data migration schedule (including ASR-DR request) |
| `TargetArchitectureSection` | Target Architecture | Summary, topology, new services |
| `RisksBlockersSection` | Risks & Blockers | Risk list with create/edit/delete |
| `StageProgressStepper` | Stage progress | Horizontal stepper for `setup → survey → signoff → migration` |
| `SignOffWorkflowBar` | Sign-off | Approval status timeline visualization |

### Project scoring tooltips

Two tooltip components render the **Infra Footprint** and **Migration Driver** score matrices on the Projects list page. They wrap a trigger element (usually a table cell label) and highlight the matrix row that matches each input column for the project. Scores are precomputed server-side (`backend/app/services/scoring_service.py`) and shipped on each `ProjectTableRow`; the tooltips take the result object directly.

```tsx
<InfraFootprintTooltip result={project.infraFootprint}>
  <span className="cursor-help border-b border-dashed border-muted-foreground/50">
    {project.infraFootprint.score ?? '—'}
  </span>
</InfraFootprintTooltip>
```

```tsx
<MigrationDriverTooltip result={project.migrationDriver}>
  <span className="cursor-help border-b border-dashed border-muted-foreground/50">
    {project.migrationDriver.score ?? '—'}
  </span>
</MigrationDriverTooltip>
```

| Component | Score source | Inputs |
|---|---|---|
| `InfraFootprintTooltip` | `ProjectTableRow.infraFootprint` (`GET /api/v1/projects/table`; computed by `scoring_service.get_infra_footprint_score`, mirroring `src/lib/scoring.ts`) | Prod ECS count, DB/OSS data volume (TB), prod MaxCompute count |
| `MigrationDriverTooltip` | `ProjectTableRow.migrationDriver` (`GET /api/v1/projects/table`; computed by `scoring_service.get_migration_driver_score`, mirroring `src/lib/scoring.ts`) | Application tier + IITA, third-party FTE, dependency count, external/internal user counts, number of apps |

### `StageProgressStepper`

Renders the four project stages as a horizontal stepper on `ProjectDetailsPage`.

**Behavior:**
- Each stage shows an icon, label, and a short detail line.
- Completed stages are green; partial stages are amber.
- The `survey` stage behaves like the `signoff` stage:
  - Detail shows `0/2 submitted`, `1/2 submitted`, or `Submitted`.
  - Becomes clickable once `setup` is complete and at least one survey is pending.
  - Clicking expands a panel listing:
    - **Application Survey** — submitted or pending.
    - **Data Migration Survey** — submitted or pending.
- The `signoff` stage expands the multi-role approval timeline when clicked.
- The sign-off stage only becomes clickable after both surveys are submitted.

---

## Drawers

Drawers are right-side slide-in panels built on the shadcn/ui `Sheet` component. They are opened by section edit buttons and closed by their own footer Cancel/Save buttons.

**Base pattern:**
```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent>
    <SheetHeader>…</SheetHeader>
    {/* form fields */}
    <SheetFooter>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Section edit drawers

| Drawer | Opens from |
|---|---|
| `ApplicationProfileDrawer` | Application Overview — app profile card |
| `ContactsOwnershipDrawer` | Application Overview — contacts card |
| `CloudResourceEditDrawer` | Cloud Resources — individual resource row |
| `UpstreamDependenciesDrawer` | Dependencies — upstream table |
| `DownstreamDependenciesDrawer` | Dependencies — downstream table |
| `TLSCertificatesDrawer` | Dependencies — TLS certificates card |
| `APIKeysDrawer` | Dependencies — API keys card |
| `SecretsManagementDrawer` | Dependencies — secrets management card |
| `AZResilienceDrawer` | Availability — resilience card |
| `RecoveryTargetsDrawer` | Availability — recovery targets card |
| `DatabaseStorageDrawer` | Data & Persistence |
| `DataGovernanceDrawer` | Data & Persistence — governance card |
| `PerformanceScaleDrawer` | Non-Functional Requirements |
| `ObservabilityGovernanceDrawer` | Non-Functional Requirements — observability card |
| `ScheduleWindowsDrawer` | Migration Constraints — windows card |
| `ExecutionStakeholdersDrawer` | Migration Constraints — execution card |
| `ArchitectureOverviewDrawer` | Target Architecture |
| `TechnicalChangesDrawer` | Target Architecture — changes card |
| `RiskEditDrawer` | Risks — create or edit a single risk |

### Wave drawers

| Drawer | Purpose |
|---|---|
| `CreateWaveDrawer` | Form to create a new migration wave (name, dates, description) |
| `ImportWaveDrawer` | Import an existing Jira epic by key |
| `AssignWaveDrawer` | Assign the current project to a wave |

### Category Milestone drawers

| Drawer | Purpose |
|---|---|
| `CategoryMilestoneDrawer` | Create or edit a category milestone (name, dates, colour, icon) |
| `AssignCategoryMilestoneDrawer` | Assign/unassign category milestones to the current project |

### Other drawers

| Drawer | Purpose |
|---|---|
| `AuditLogDrawer` | Displays the full audit log timeline for the current project |
| `SectionEditDrawer` | Generic base drawer — useful as a template for new drawers |

### Drawer utilities (sub-components)

- **`StringListEditor`** — Dynamic add/remove input for string arrays (used for compliance requirements, new services, etc.)
- **`DateRangeEntryEditor`** — Date range entry with from/to date pickers (used for blackout dates and change freeze periods)

---

## Waves

### `WaveGanttChart`

The interactive Gantt chart used by `WaveGanttPage`. Renders waves as collapsible groups, projects as draggable rows, and milestones as interactive timeline bars. Supports zoom (days/weeks/months), drag-to-resize/move milestones, dependency arrows, embargo overlays, and inline status changes.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `waves` | `Wave[]` | Migration waves |
| `projects` | `Project[]` | Projects to render inside waves |
| `categoryMilestones` | `CategoryMilestone[]` | Category milestones injected into project rows |
| `bgiRoot` | `BgiNode \| null` | BGI hierarchy root node; enables the BGI filter popover |
| `bgiScopeId` | `string \| null` | Optional scope ID that restricts selectable tree nodes |
| `bgiMaxDepth` | `number \| null` | Optional max depth for the BGI tree display |
| `onUpdatePlanning` | `(projectId, planning) => Promise<void>` | Saves updated planning dates/milestones |
| `onUpdateProjectOrder` | `(waveId, projectIds) => Promise<void>` | Optional — allows drag-reordering projects within a wave |
| `onAssign` | `(projectId, waveId) => void` | Optional — assigns a project to a wave |
| `readOnly` | `boolean` | Disables all drag and create interactions |

**Controls bar (top of chart):**

| Control | Description |
|---|---|
| Zoom toggle | `days` / `weeks` / `months` |
| Today button | Scrolls timeline to today's date |
| Show completed waves | Toggle to hide `completed` waves |
| BGI filter | Popover with searchable `BgiTree` — select/unselect/exclude nodes to filter visible projects. Only shown when `bgiRoot` is provided. Uses the same tree-selection logic as `ProjectsPage`. |
| Category Milestones filter | Dropdown multi-select to show only projects with specific category milestones |
| Expand / Collapse all | Bulk toggle for wave and project row visibility |

**Milestone rows:**

| Milestone type | Source | Behavior |
|---|---|---|
| **Data Migration Period** | Derived from `Project.dataMigrationPlan ?? Project.dataMigrationSchedule` | Always rendered first under a project. Uses a `DatabaseBackup` icon and the label **“Data Migration”**. The period spans the earliest start to the latest end across `startDate`/`endDate` and any `cycleBlocks`. Dates are rendered **inclusively** (the end date is included in the bar width and duration label). It is read-only: no drag, resize, reorder, delete, or status change from the Gantt. Hovering the bar shows a styled tooltip with `start → end`. |
| Category milestones | `Project.categoryMilestoneIds` linked to `CategoryMilestone` master data | Rendered after the data migration period. Dates and status can be overridden per project from the Gantt. |
| Planning milestones | `ProjectPlanning.milestones` | Rendered after category milestones. Created, edited, reordered, and deleted via the project row’s **Add milestone** menu. |

> **Add milestone menu:** The dropdown no longer includes the **DEV Data Migration Stage** and **PRD Data Migration Stage** presets. The data migration period is now the authoritative representation for data migration scheduling on the Gantt.

**Filtering logic:** All filters (search, duration, category milestones, BGI) are combined with AND. A wave is hidden when none of its projects match the active filters.

---

## Modals

### `DataMigrationSurveyModal`

Multi-step modal for collecting a project's data migration schedule.

**Steps:**
1. **Cycle block selection** — Pick a migration cycle block from a calendar list. Each block shows general capacity (`bookedCount / cycleCapacity`) and ASR-DR license capacity (`asrDrBookedCount / asrDrLicenseCapacity`). Fully-booked blocks are marked and disabled unless the current project is already booked there.
2. **Migration cycles** — Select the number of migration cycles and provide a justification if above the configured minimum.
3. **DTS instances** — Select the number of DTS instances and provide a justification if above the configured minimum.

**ASR-DR handling:**
- If the selected block has remaining ASR-DR licenses, a checkbox lets the user request one.
- If the block is fully booked for ASR-DR, the UI explains the constraint and allows an optional justification.
- Selecting a different block resets the ASR-DR selection unless it matches the existing saved block.

On submit, the modal calls `onSave('dataMigrationSchedule', payload)` and then marks the data migration survey as submitted.

---

### `SignOffModal`

The two-step sign-off workflow:

- **Step 1** (all roles) — Role confirmation and acknowledgement checkbox
- **Step 2** (Platform Migration Lead only) — Jira sub-task configuration: choose between `resource-level`, `category-level`, or `custom` sub-task grouping, with a live count preview

On submit, calls `saveSection('approvals', ...)` and (for Platform Lead) triggers `createJiraJob()`.

### `ApprovalTimeline`

Visual timeline showing approval status for all three roles — used inside `SignOffWorkflowBar` and `SignOffModal`.

---

## Audit

### `AuditLogTimeline`

Renders a scrollable timeline of `AuditLogEntry` records. Each entry shows the actor avatar, event type icon, section label, timestamp, and a collapsible list of field-level changes (old → new).

---

## UI primitives (`components/ui/`)

These are unmodified shadcn/ui components. Do not edit them directly — re-generate with the shadcn CLI if updates are needed.

Key primitives used throughout the app: `Button`, `Card`, `Badge`, `Avatar`, `Sheet`, `Drawer`, `Table`, `Tabs`, `Select`, `Checkbox`, `Popover`, `Calendar`, `DropdownMenu`, `ToggleGroup`, `Tooltip`, `Skeleton`, `Separator`, `Breadcrumb`, `Label`, `Input`, `Sonner` (toast config).
