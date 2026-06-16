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
type TaskType         = 'onboarding' | 'migrate-computing' | 'migrate-database' | 'migrate-storage' | 'migrate-logs' | 'migrate-big-data' | 'custom'
type TaskStatus       = 'todo' | 'in-progress' | 'done'
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
  cycleCount?: number
  cycleJustification?: string
  dtsInstanceCount?: number
  dtsJustification?: string
}
```

Captured by the data migration survey and stored as a project section.

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
  startDate: string
  endDate: string
  tasks: PlanningTask[]
  categoryMilestoneOverrides?: Record<string, { start: string; end: string; status?: MilestoneStatus }>
}

interface PlanningTask {
  id: string
  name: string
  type: TaskType
  start: string
  end: string
  status: TaskStatus
  deps: string[]
}
```

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
