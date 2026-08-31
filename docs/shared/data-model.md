# Data Model

This document is the canonical reference for the core domain types. The frontend TypeScript interfaces in `frontend/src/types/` are the current source of truth. Backend Pydantic schemas mirror these shapes where possible, with two intentional deviations documented below.

---

## Primitive types

```ts
type ProjectStatus    = 'migrating' | 'signed-off' | 'blocked' | 'planning' | 'in-progress' | 'completed'
type ApprovalStatus   = 'approved' | 'pending' | 'waiting'
type RiskSeverity     = 'critical' | 'high' | 'medium' | 'low'
type SyncStatus       = 'synced' | 'out-of-sync' | 'provisioning'
type ActivityType     = 'success' | 'info' | 'error'
type ApplicationTier  = 'T0' | 'T1' | 'T2' | 'T3'
type WaveStatus       = 'planned' | 'active' | 'completed'
type MigrationStrategy = 'Lift & Shift' | 'Refactor' | 'Deboard'
type ResourceCategory = 'computing' | 'security' | 'networking' | 'database' | 'storage' | 'middleware' | 'analytics-computing' | 'monitoring'
type EngagementStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no_show'
type MilestoneStatus = 'todo' | 'in-progress' | 'done'
```

> **Backend deviation:** `ApprovalStatus` in the backend is stored as `'pending' | 'approved' | 'rejected'`. The frontend type retains `'waiting'` for historical UI states but the backend never returns it.

---

## User

```ts
interface User {
  id: string
  name: string
  email: string
  department: string
  team?: string
  initials: string
  role: string[]          // e.g. ['platform_migration_lead']
}
```

`User.role` drives feature-level access control. Project-level visibility is controlled separately by `project_users` associations.

> **Backend deviation:** The database stores `role` as a comma-separated string (e.g. `'platform_migration_lead,admin'`). The backend API returns it as a single nullable string; the frontend is responsible for splitting into an array if needed.

---

## TeamMember

```ts
interface TeamMember {
  id: string
  name: string
  avatarUrl?: string
  initials?: string
}
```

A lightweight user reference embedded in `Project.team`. Populated from `project_users` at API serialization time; there is **no `team` column** on the `projects` table.

---

## Project

```ts
interface Project {
  id: string
  name: string
  status: ProjectStatus
  blockedReason?: string
  progress: number               // 0–100; computed from stage_progress, not stored
  stageProgress?: StageProgress   // computed from section completion, not stored
  surveySubmittedAt?: string      // application survey submission timestamp
  dataMigrationSurveySubmittedAt?: string  // data migration survey submission timestamp
  team: TeamMember[]
  description?: string
  // Header metadata
  migrationWave?: string         // legacy display label; waveId takes precedence
  itso?: string
  updatedAt?: string
  // Register sections (all optional — filled in progressively)
  applicationOverview?: ApplicationOverview
  currentInfrastructure?: CurrentInfrastructure
  availability?: AvailabilityResilience
  dataPersistence?: DataPersistence
  dependencies?: Dependencies
  nfrs?: NonFunctionalRequirements
  migrationConstraints?: MigrationConstraints
  targetArchitecture?: TargetArchitecture
  migrationEffortEstimation?: MigrationEffortEstimation
  dataMigrationSchedule?: DataMigrationSchedule
  dataMigrationPlan?: DataMigrationSchedule
  risks: Risk[]
  approvals: Approval[]
  // Wave planning
  waveId?: string
  planning?: ProjectPlanning
  jiraSubtaskConfig?: JiraSubtaskConfig
  jiraStoryKey?: string
  jiraJobStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  categoryMilestoneIds?: string[]
  bgi_id?: string | null    // BGI node assignment
}
```

> **`progress` and `stageProgress` are computed fields.** The backend calculates them on every read from section completion state (`setup`, `survey`, `signoff`, `migration`). They are not database columns.

### Section 1 — ApplicationOverview

```ts
interface ApplicationOverview {
  applicationName: string
  shortName?: string
  businessFunction?: string
  userBase?: { type: 'Internal' | 'External' | 'Both'; count?: string }
  applicationTier?: ApplicationTier
  baId?: string
  systemImportanceClassification?: ('IBS' | 'BPS')[]
  iitaApplicability?: boolean
  softwareOrigin?: 'in-house' | '3rd party'
  migrationStrategy?: MigrationStrategy
  serviceLine?: string
}
```

### Section 2 — CurrentInfrastructure

```ts
interface CurrentInfrastructure {
  resources: CloudResource[]
}

interface CloudResource {
  resourceId: string
  name: string
  product?: string
  resourceSet?: string
  specs?: Record<string, unknown>
  subApplication?: string
  targetResourceId?: string
  syncStatus: SyncStatus
  needMigration?: boolean
  jiraSubtaskKey?: string
  migrationCompleted?: boolean
}

interface ProductCategoryEntry {
  product: string
  product_name: string
  category: ResourceCategory
}
```

### Section 3 — AvailabilityResilience

```ts
interface AvailabilityResilience {
  rto: string
  rpo: string
  azReadiness3Az?: string
  healthCheckEndpoints?: string[]
}
```

### Section 4 — DataPersistence

```ts
interface DataPersistence {
  databaseTypes: string[]
  totalDataVolume?: string
  dataGrowthRate?: string
  backupRequiredDuringMigration?: boolean
  lastRestoreTest?: string
  dataResidency?: string
  encryptionAtRest?: string
  statefulComponents?: string[]
}
```

### Section 5 — Dependencies

```ts
interface Dependencies {
  upstream: DependencyEntry[]
  downstream: DependencyEntry[]
}

interface DependencyEntry {
  id: string
  name: string
  baId?: string
  contactEmail?: string
  hosting?: string
  notes?: string
}
```

### Section 6 — NonFunctionalRequirements

```ts
interface NonFunctionalRequirements {
  peakLoad: string
  autoscaling: string
  licensing: string
}
```

### Section 7 — MigrationConstraints

```ts
interface MigrationConstraints {
  regularMigrationWindow: string
  preferredMigrationWindow?: ('weekday' | 'weekend')[]
  earliestStartDate?: string
  latestEndDate?: string
  crDurationHours?: number
  snowCiGroups?: string[]
  changeFreezePeriods?: DateRangeEntry[]
}

interface DateRangeEntry {
  name: string
  from: string
  to?: string
}
```

### Section 7.5 — DataMigrationSchedule

```ts
interface DataMigrationSchedule {
  startDate?: string
  endDate?: string
  cycleBlocks?: { startDate: string; endDate: string }[]
  cycleCount?: number
  cycleCountOption?: 'min' | 'more'
  cycleJustification?: string
  dtsInstanceCount?: number
  dtsJustification?: string
  needAsrDr?: boolean
  asrDrJustification?: string
  bgiCloudLeadId?: string
  approvalAcknowledged?: boolean
  forwardAcknowledged?: boolean
  confirmAcknowledged?: boolean
  acceptsTimeAdjustment?: boolean
  completedAt?: string
  completedBy?: string
  completionRemark?: string
  reopenedAt?: string
  reopenedBy?: string
  reopenReason?: string
  adjustedAt?: string
  adjustedBy?: string
}
```

Captured by the data migration survey and stored as a project section. `dataMigrationPlan` is a later platform-lead-adjusted copy of the same shape. On the Wave Gantt chart the two are combined into a single immutable **Data Migration Period** milestone: the earliest start and latest end across `startDate`/`endDate` and any `cycleBlocks` are used, and the end date is treated inclusively.

---

## DataMigrationSettings

Platform-configured constraints for the data migration survey. Stored in `config_store` under the key `migration_settings`.

```ts
interface DataMigrationSettings {
  cycleDurationDays: number
  minCycle: number
  maxCycle: number
  minDtsInstanceCount: number
  maxDtsInstanceCount: number
  cyclePeriod?: DataMigrationPeriod
  cycleCapacity: number
  asrDrLicenseCapacity: number
}

interface DataMigrationPeriod {
  startDate?: string
  endDate?: string
}
```

| Field | Description |
|---|---|
| `cycleDurationDays` | Length of each selectable cycle block in days |
| `minCycle` / `maxCycle` | Minimum and maximum migration cycles a project may request |
| `minDtsInstanceCount` / `maxDtsInstanceCount` | Bounds for DTS instance requests |
| `cycleCapacity` | Maximum projects that can book each cycle block |
| `asrDrLicenseCapacity` | Maximum ASR-DR licenses that can book each cycle block |

---

## DataMigrationCycleBlock

A selectable window in the data migration calendar, returned with current booking counts.

```ts
interface DataMigrationCycleBlock {
  startDate: string
  endDate: string
  bookedCount: number
  asrDrBookedCount: number
}
```

### Section 8 — TargetArchitecture

```ts
interface TargetArchitecture {
  reArchitectureNeeded?: boolean
  topology3Az?: string
  dnsIpChanges?: string
  newServicesRequired?: string[]
  architectureDiagram?: string
}
```

### Section 8.5 — MigrationEffortEstimation

```ts
interface MigrationEffortEstimation {
  effortEstimate?: string
  notes?: string
  attachmentIds?: string[]
  tables?: EffortTable[]
  tableMode?: 'single' | 'multiple'
}

interface EffortTable {
  baId?: string
  tasks: EffortTask[]
}

interface EffortTask {
  task: string
  effortType?: string
  effort?: number
  effortTime?: number
  rate?: number
  thirdParty?: boolean
  remarks?: string
}
```

### Section 9 — Risk

```ts
interface Risk {
  id: string
  title: string
  description: string
  severity: RiskSeverity
  mitigation?: string
  owner?: string
  riskStatus?: string
}
```

### Section 10 — Approval

```ts
interface Approval {
  id: string
  role: string
  approver?: string
  status: ApprovalStatus
  timestamp?: string
  icon: string
  userId?: string
}
```

---

## Wave

```ts
interface Wave {
  id: string
  name: string
  startDate: string
  cutoverDate: string
  description?: string
  jiraProjectKey: string
  jiraEpicKey?: string
  source: 'created' | 'imported'
  status: WaveStatus
  createdAt: string
}
```

---

## ProjectPlanning

Gantt-managed planning data stored as a JSONB blob:

```ts
interface ProjectPlanning {
  startDate: string   // derived from the union of the project's milestones; cached for backend consumers
  endDate: string     // derived (max end across the milestone union)
  milestones: PlanningMilestone[]
  categoryMilestoneOverrides?: Record<string, { start: string; end: string; status?: MilestoneStatus }>
}

interface PlanningMilestone {
  id: string           // '<type>-<projectId>' for preset milestones; random UUID for custom
  name: string
  type: MilestoneType
  start: string      // ISO date
  end: string        // ISO date
  status: MilestoneStatus
  deps: string[]     // other PlanningMilestone ids
  comments?: MilestoneComment[]   // { id, text, author, createdAt }
}

type MilestoneType =
  | 'env-provision'
  | 'dev-resource-provision'
  | 'dev-data-migration'
  | 'dev-cutover'
  | 'prd-resource-provision'
  | 'prd-data-migration'
  | 'prd-cutover'
  | 'custom'
  | 'category-milestone'
  | 'data-migration-period'   // derived, read-only, Gantt only

type MilestoneStatus = 'todo' | 'in-progress' | 'done'
```

> **Note:** `data-migration-period` is not stored in `ProjectPlanning.milestones`. It is derived at render time from `Project.dataMigrationPlan ?? Project.dataMigrationSchedule` and injected as the first milestone row under each project in the Wave Gantt chart.
>
> `env-provision` milestones are likewise derived at render time from `Project.environmentProvision` — one per checked environment with a date (`env-provision-date-<projectId>-dev` / `-prd`).

---

## EnvironmentProvision

Per-environment provision data stored as a JSONB blob on the project (`environment_provision`),
managed on the Environment Provision page:

```ts
interface EnvironmentProvision {
  dev?: EnvironmentProvisionEntry    // key present = environment checked
  prod?: EnvironmentProvisionEntry
}

interface EnvironmentProvisionEntry {
  date?: string                                   // ISO date 'yyyy-MM-dd'
  cidrs?: Partial<Record<ProvisionZone, string>>  // optional /26 or /27 per availability zone
  completedAt?: string | null
}

type ProvisionZone = 'zoneA' | 'zoneB' | 'zoneC'
```

Each zone CIDR must be a network-aligned block carved from the configured parent blocks for that
environment + zone with an allowed prefix length (default `/25`, `/26`, `/27`), and must not overlap
a CIDR allocated to another project. Parent blocks and allowed prefixes are admin-configurable
(Admin → Provision CIDR Blocks) and stored in migration settings:

```ts
// MigrationSettings.provisionCidrParents (api: provision_cidr_parents, zone_a/zone_b/zone_c)
interface ProvisionCidrParents {
  dev: Record<ProvisionZone, string[]>
  prod: Record<ProvisionZone, string[]>
}

// MigrationSettings.provisionAllowedPrefixes (api: provision_allowed_prefixes)
// default: [25, 26, 27]
```

Defaults: dev/A `10.248.32.0/20, 10.248.48.0/20, 10.248.64.0/20`; dev/B `10.248.160.0/20, 10.248.176.0/20, 10.248.192.0/20`;
dev/C `10.249.32.0/20, 10.249.48.0/20, 10.249.64.0/20`; prod/A `10.248.80.0/20, 10.248.96.0/20, 10.248.112.0/20`;
prod/B `10.248.208.0/20, 10.248.224.0/20, 10.248.240.0/20`; prod/C `10.249.80.0/20, 10.249.96.0/20, 10.249.112.0/20`.

> **Legacy shape:** older records stored `{ date, environments: ('dev'|'prod')[], completedAt }`.
> The frontend normalizes these on read (date/completedAt copied into each checked environment);
> the next save writes the new shape.

---

## StageProgress

Computed per-stage completion percentages returned by the API:

```ts
interface StageProgress {
  setup: number      // 0 or 100
  survey: number     // 0 or 100; driven by both application and data-migration survey submissions
  signoff: number    // 0, 33, 67, or 100
  migration: number  // 0–100
}
```

---

## JiraSubtaskConfig

```ts
interface JiraSubtaskConfig {
  mode: 'resource-level' | 'category-level' | 'product-level' | 'custom'
  selectedResourceIds?: string[]
  selectedCategories?: string[]
}
```

| Mode | Sub-task granularity |
|---|---|
| `resource-level` | One sub-task per `CloudResource` in scope |
| `category-level` | One sub-task per unique `ResourceCategory` |
| `product-level` | One sub-task per unique `product` |
| `custom` | One sub-task per resource in `selectedResourceIds` |

---

## JiraJobRequest

```ts
interface JiraJobRequest {
  id: string
  projectId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  config: JiraSubtaskConfig
  requestedAt: string
  processedAt?: string
  storyKey?: string
  subtaskKeys: Record<string, string>
}
```

---

## OperationJob

Change-request jobs created after initial Jira story creation:

```ts
interface OperationJobOut {
  id: string
  projectId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  config: {
    type: 'operation'
    selected_subtask_keys: string[]
    summary: string
  }
  requestedAt: string | null
  processedAt: string | null
  crSubtaskKey: string | null
}
```

---

## Audit types

```ts
type AuditEventType =
  | 'section_updated'
  | 'status_changed'
  | 'approval_submitted'
  | 'risk_created' | 'risk_updated' | 'risk_deleted'
  | 'resource_updated' | 'resource_sync_completed'
  | 'resource_added' | 'resource_removed'
  | 'wave_assigned' | 'wave_created' | 'wave_imported'
  | 'jira_story_created'
  | 'survey_submitted'
  | 'data_migration_survey_submitted'
  | 'project_created'

type AuditEntityType = 'project' | 'section' | 'approval' | 'risk' | 'cloud_resource' | 'wave'

interface AuditLogEntry {
  id: string
  projectId: string
  timestamp: string
  actor: AuditActor
  eventType: AuditEventType
  entityType: AuditEntityType
  entityId?: string
  entityLabel?: string
  sectionKey?: string
  sectionLabel?: string
  changes: AuditChange[]
}

interface AuditActor {
  id: string
  name: string
  initials: string
}

interface AuditChange {
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
}
```

---

## Engagement

An engagement is created 1:1 per project to track migration interview scheduling and notes. It is embedded in the `Project` object returned by the API and updated via `PATCH /api/v1/projects/:id/sections/engagement`.

```ts
interface EngagementSlot {
  id: string
  start: string       // ISO datetime
  end: string         // ISO datetime
  isActual?: boolean  // true for the confirmed interview slot
}

interface Engagement {
  status: EngagementStatus
  interviewSubject?: string
  plannedSlots: EngagementSlot[]
  participantIds: string[]        // user IDs
  engagementManagerId?: string    // user ID of the responsible platform lead
  notes?: unknown[]               // Notion Block[] stored as JSONB
  confluencePageId?: string       // set after first Confluence export
  confluencePageUrl?: string
  zoomMeetingUrl?: string
  zoomMeetingId?: string
}
```

---

## CategoryMilestone

Master-data milestones that can be assigned to multiple projects. Used to overlay category-level timelines (e.g. "Compute migration window") across the wave Gantt chart.

```ts
interface CategoryMilestone {
  id: string
  name: string
  startDate: string       // ISO date 'yyyy-MM-dd'
  endDate: string         // ISO date 'yyyy-MM-dd'
  color?: string
  icon?: string
  createdAt: string       // ISO 8601
}
```

Assignments are many-to-many: a project can have multiple category milestones, and a category milestone can belong to multiple projects. The backend stores this via the `project_category_milestone` association table.

## NoteTemplate

Reusable Notion-block collections with scope-based visibility. Managed via `/api/v1/note-templates`.

```ts
interface NoteTemplate {
  id: string
  name: string
  description?: string
  labels: string[]
  blocks: unknown[]                          // Notion Block[]
  scope: 'global' | 'private' | 'function'
  sharedRoles?: string[]                     // roles that can view (scope='function')
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}
```

---

## NoteTemplateVersion

Immutable snapshot of a `NoteTemplate` at a point in time. A snapshot is created automatically before every update and before every restore.

```ts
interface NoteTemplateVersion {
  id: string
  templateId: string
  versionNumber: number
  name: string
  description?: string
  labels: string[]
  blocks: unknown[]
  scope: 'global' | 'private' | 'function'
  sharedRoles?: string[]
  createdBy?: string
  createdAt?: string
}
```

---

## Dashboard types

```ts
interface OverallStats {
  progress: number
  totalAssets: number
  targetCloud: string
  completed: number
  inProgress: number
}

interface Activity {
  id: string
  type: ActivityType
  message: string
  time: string
  actor: string
  projectId?: string
  projectName?: string
}
```

---

## BGI Hierarchy

Organizational tree used to scope project visibility and filtering.

```ts
interface BgiNode {
  id: string
  name: string
  children?: BgiNode[]
}

interface BgiHierarchy {
  root: BgiNode | null
}
```

`Project.bgi_id` links a project to a single BGI node. The tree supports hierarchical selection (selecting a parent implicitly includes all descendants) and exclusion (deselecting individual children under a selected parent).
