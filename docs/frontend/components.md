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
Primary navigation links (Home, Waves).

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
| `MigrationCutoverSection` | Migration Constraints | Migration windows, blackout dates, rollback plan |
| `TargetArchitectureSection` | Target Architecture | Summary, topology, new services |
| `RisksBlockersSection` | Risks & Blockers | Risk list with create/edit/delete |
| `SignOffWorkflowBar` | Sign-off | Approval status timeline visualization |

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

### Other drawers

| Drawer | Purpose |
|---|---|
| `AuditLogDrawer` | Displays the full audit log timeline for the current project |
| `SectionEditDrawer` | Generic base drawer — useful as a template for new drawers |

### Drawer utilities (sub-components)

- **`StringListEditor`** — Dynamic add/remove input for string arrays (used for compliance requirements, new services, etc.)
- **`DateRangeEntryEditor`** — Date range entry with from/to date pickers (used for blackout dates and change freeze periods)

---

## Modals

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
