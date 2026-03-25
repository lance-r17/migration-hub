# Data Model

This document is the canonical reference for the core domain types. The frontend TypeScript interfaces in `frontend/src/types/` are the current source of truth. When the backend is built, its Pydantic schemas should match these shapes exactly.

---

## Primitive types

```ts
type ProjectStatus    = 'migrating' | 'signed-off' | 'blocked' | 'planning' | 'in-progress' | 'completed'
type ApprovalStatus   = 'approved' | 'pending' | 'waiting'
type RiskSeverity     = 'critical' | 'medium' | 'low'
type SyncStatus       = 'synced' | 'out-of-sync' | 'provisioning'
type ActivityType     = 'success' | 'info' | 'error'
type ApplicationTier  = 'P1' | 'P2' | 'P3'
type WaveStatus       = 'planned' | 'active' | 'completed'
```

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
  role?: string         // e.g. 'Platform Migration Lead'
}
```

`User.role` drives feature-level access control. Project-level visibility is controlled separately by the `ProjectUsers` association.

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

A lightweight user reference embedded in `Project.team`. Populated from `User` data.

---

## Project

```ts
interface Project {
  id: string
  name: string
  status: ProjectStatus
  progress: number          // 0–100 percentage
  team: TeamMember[]
  description?: string
  // Header metadata
  migrationWave?: string    // legacy display label; waveId takes precedence
  profileOwner?: string
  jiraTicket?: string
  lastUpdated?: string
  // 10 register sections (all optional — filled in progressively)
  applicationOverview?: ApplicationOverview
  currentInfrastructure?: CurrentInfrastructure
  availability?: AvailabilityResilience
  dataPersistence?: DataPersistence
  dependencies?: Dependencies
  nfrs?: NonFunctionalRequirements
  migrationConstraints?: MigrationConstraints
  targetArchitecture?: TargetArchitecture
  risks: Risk[]
  approvals: Approval[]
  // Wave planning
  waveId?: string             // references Wave.id
  jiraSubtaskConfig?: JiraSubtaskConfig
  jiraStoryKey?: string       // e.g. 'MIG-42', written by async Jira job
  jiraJobStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}
```

### Section 1 — ApplicationOverview

```ts
interface ApplicationOverview {
  applicationName: string
  shortName?: string
  businessOwnerId?: string    // User.id
  technicalLeadId?: string    // User.id
  dbaDataOwnerId?: string     // User.id
  businessFunction?: string
  userBase?: { type: 'Internal' | 'External' | 'Both'; count?: string }
  applicationTier?: ApplicationTier
  eimId?: string
}
```

### Section 2 — CurrentInfrastructure

```ts
interface CurrentInfrastructure {
  resources: CloudResource[]
  network?: NetworkConfig
}

interface CloudResource {
  id: string
  name: string
  category: 'VM' | 'Database' | 'Buckets' | 'Network' | 'Other'
  existingStatus: string
  targetStatus: string
  syncStatus: SyncStatus
  specs?: string
  quantity?: number
  availabilityZones?: string[]
  needMigration?: boolean       // default true; false = excluded from migration scope
  jiraSubtaskKey?: string       // populated by async Jira job after sign-off
}

interface NetworkConfig {
  loadBalancerType?: string
  vipDnsNames?: string[]
  firewallZones?: string[]
  bandwidthRequirements?: string
  hardcodedIps?: boolean
  privateConnectivity?: string
}
```

### Section 3 — AvailabilityResilience

```ts
interface AvailabilityResilience {
  rto: string
  rpo: string
  availabilitySla: string
  currentAzPattern?: string
  azAwareToday?: boolean
  azFailureBehaviour?: string
  azReadiness3Az?: string
  healthCheckEndpoints?: string[]
  currentTopologyDescription?: string
}
```

### Section 4 — DataPersistence

```ts
interface DataPersistence {
  databaseTypes: string[]
  totalDataVolume?: string
  dataGrowthRate?: string
  replicationTopology?: string
  backupMethod?: string
  lastRestoreTest?: string
  dataResidency?: string
  encryptionAtRest?: string
  piiData?: boolean
  statefulComponents?: string[]
}
```

### Section 5 — Dependencies

```ts
interface Dependencies {
  upstream: DependencyEntry[]
  downstream: DependencyEntry[]
  certificatesSecrets?: CertificatesSecrets
}

interface DependencyEntry {
  id: string
  name: string
  protocol?: string
  port?: string
  access?: 'Internal' | 'External'
  owner?: string
  notes?: string
}

interface CertificatesSecrets {
  tlsCertificates?: string
  secretsManagement?: string
  apiKeys?: string
}
```

### Section 6 — NonFunctionalRequirements

```ts
interface NonFunctionalRequirements {
  peakLoad: string
  autoscaling: string
  seasonalPatterns: string
  latencySensitivity: string
  monitoring: string
  logAggregation: string
  compliance: string[]
  licensing: string
}
```

### Section 7 — MigrationConstraints

```ts
interface MigrationConstraints {
  migrationWindow: string
  blackoutDates: DateRangeEntry[]
  changeFreezePeriods?: DateRangeEntry[]
  maxCutoverWindow?: string
  cutoverApproach: string
  rollbackPlan: string
  stakeholderComms: string
  preMigrationTesting: string
}

interface DateRangeEntry {
  name: string
  from: string    // ISO date string e.g. '2024-12-20'
  to?: string     // ISO date string; omit for single-day events
}
```

### Section 8 — TargetArchitecture

```ts
interface TargetArchitecture {
  summary: string
  constraints: string
  reArchitectureNeeded?: boolean
  topology3Az?: string
  replicationChanges?: string
  dnsIpChanges?: string
  newServicesRequired?: string[]
  architectureDiagram?: string
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
  role: string            // e.g. 'Technical Lead'
  approver?: string       // display name of the approver
  status: ApprovalStatus
  timestamp?: string      // ISO 8601
  icon: string            // icon name for display
  userId?: string         // User.id of the approver
}
```

---

## Wave

```ts
interface Wave {
  id: string
  name: string            // e.g. 'Wave 3 – Q2 2026'
  startDate: string       // ISO date string e.g. '2026-04-01'
  cutoverDate: string     // ISO date string
  description?: string
  jiraProjectKey: string  // e.g. 'MIG' — set by backend/config
  jiraEpicKey?: string    // e.g. 'MIG-42', populated after creation or import
  source: 'created' | 'imported'
  status: WaveStatus
  createdAt: string       // ISO 8601
}
```

---

## JiraSubtaskConfig

Controls how Jira sub-tasks are grouped when a project is signed off:

```ts
interface JiraSubtaskConfig {
  mode: 'resource-level' | 'category-level' | 'custom'
  selectedResourceIds?: string[]   // used when mode === 'custom'
  selectedCategories?: string[]    // used when mode === 'category-level'
}
```

| Mode | Sub-task granularity |
|---|---|
| `resource-level` | One sub-task per `CloudResource` in scope |
| `category-level` | One sub-task per unique resource category (VM, Database, etc.) |
| `custom` | One sub-task per resource in `selectedResourceIds` |

---

## JiraJobRequest

The async job record created when sign-off triggers Jira issue creation:

```ts
interface JiraJobRequest {
  id: string
  projectId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  config: JiraSubtaskConfig
  requestedAt: string         // ISO 8601
  processedAt?: string        // ISO 8601, set on completion
  storyKey?: string           // e.g. 'MIG-200'
  subtaskKeys: Record<string, string>
  // Key semantics depend on config.mode:
  //   resource-level → { [resourceId]: subtaskKey }
  //   category-level → { [category]: subtaskKey }
  //   custom         → { [resourceId]: subtaskKey } (selected IDs only)
}
```

---

## Audit types

See [jira-integration.md](jira-integration.md) for Jira-specific audit events.

```ts
type AuditEventType =
  | 'section_updated'
  | 'status_changed'
  | 'approval_submitted'
  | 'risk_created' | 'risk_updated' | 'risk_deleted'
  | 'resource_updated' | 'resource_sync_completed'
  | 'wave_assigned' | 'wave_created' | 'wave_imported'
  | 'jira_story_created'

type AuditEntityType = 'project' | 'section' | 'approval' | 'risk' | 'cloud_resource' | 'wave'

interface AuditLogEntry {
  id: string
  projectId: string
  timestamp: string           // ISO 8601
  actor: AuditActor
  eventType: AuditEventType
  entityType: AuditEntityType
  entityId?: string           // risk.id, resource.id, approval.id
  entityLabel?: string        // human-readable entity name
  sectionKey?: string         // keyof Project being updated
  sectionLabel?: string       // e.g. 'Application Overview'
  changes: AuditChange[]
}

interface AuditActor {
  id: string
  name: string
  initials: string
}

interface AuditChange {
  field: string       // technical key e.g. 'rto'
  label: string       // human-readable e.g. 'RTO'
  oldValue: unknown
  newValue: unknown
}
```

---

## Dashboard types

```ts
interface OverallStats {
  progress: number      // 0–100
  totalAssets: number
  targetCloud: string
  completed: number
  inProgress: number
}

interface Activity {
  id: string
  type: ActivityType    // 'success' | 'info' | 'error'
  message: string
  time: string          // relative or absolute time string
  actor: string
}
```
