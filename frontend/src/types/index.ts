import type { JiraSubtaskConfig } from './wave'
import type { InfraFootprintResult, MigrationDriverResult } from '@/lib/scoring'
export type { JiraSubtaskConfig }

export type ProjectStatus = 'migrating' | 'signed-off' | 'blocked' | 'planning' | 'in-progress' | 'completed'
export type ApprovalStatus = 'approved' | 'pending' | 'waiting'
export type RiskSeverity = 'critical' | 'medium' | 'low'
export type SyncStatus = 'synced' | 'out-of-sync' | 'provisioning'
export type ActivityType = 'success' | 'info' | 'error'
export type ApplicationTier = 'T0' | 'T1' | 'T2' | 'T3'

export interface TeamMember {
  id: string
  name: string
  avatarUrl?: string
  initials?: string
}

export interface User {
  id: string
  name: string
  email: string
  department: string
  team?: string
  initials: string
  role: string[]
  bgi_ids?: string[]
  projectRoles?: string[]
}

export interface ProjectUsers {
  projectId: string
  userIds: string[]
}

// ─── Section 1: Application Overview ────────────────────────────────────────

export type MigrationStrategy = 'Lift & Shift' | 'Refactor' | 'Deboard'

export interface GovernanceRoleUser {
  id: string
  name: string
  email: string
  department: string
  initials: string
}

export interface GovernanceRoles {
  technicalLead?: GovernanceRoleUser
  businessOwner?: GovernanceRoleUser
  dbaDataOwner?: GovernanceRoleUser
  gbiChampion?: GovernanceRoleUser
  gbiChampionDelegate?: GovernanceRoleUser
}

export interface ApplicationOverview {
  applicationName?: string
  shortName?: string
  businessFunction?: string
  userBase?: {
    type: 'Internal' | 'External' | 'Both'
    count?: string
  }
  applicationTier?: ApplicationTier
  baId?: string
  systemImportanceClassification?: ('IBS' | 'BPS')[]
  iitaApplicability?: boolean
  softwareOrigin?: 'in-house' | '3rd party'
  migrationStrategy?: MigrationStrategy
  serviceLine?: string
  newProjectId?: string | null
}

export interface PartialApplicationOverview extends Partial<ApplicationOverview> {}

// ─── Environment Provision ────────────────────────────────────────────────

export type ProvisionEnvironment = 'dev' | 'prod'
export type ProvisionZone = 'zoneA' | 'zoneB' | 'zoneC'
export type EnvironmentProvisionStatus = 'planned' | 'in-progress' | 'completed'

export interface EnvironmentProvisionEntry {
  date?: string                              // ISO date 'yyyy-MM-dd'
  cidrs?: Partial<Record<ProvisionZone, string>>  // optional /26 or /27 per availability zone
  completedAt?: string | null
}

export interface EnvironmentProvision {
  dev?: EnvironmentProvisionEntry   // key present = environment checked
  prod?: EnvironmentProvisionEntry
}

export function getProvisionEntryStatus(
  entry: EnvironmentProvisionEntry | undefined,
): EnvironmentProvisionStatus {
  if (!entry) return 'planned'
  if (entry.completedAt) return 'completed'
  if (!entry.date) return 'planned'
  const today = new Date().toISOString().slice(0, 10)
  if (entry.date <= today) return 'in-progress'
  return 'planned'
}

// ─── Section 2: Current Infrastructure ──────────────────────────────────────

export type ResourceCategory = 'computing' | 'security' | 'networking' | 'database' | 'storage' | 'middleware' | 'analytics-computing' | 'monitoring'

export interface ProductCategoryEntry {
  product: string
  product_name: string
  category: ResourceCategory
}

export interface CloudResource {
  resourceId: string                  // e.g. "i-abc1234"
  name: string
  product?: string                     // e.g. "ecs", "polarDB", "rds", "oss", "sls", "slb", "dns"
  resourceSet?: string                 // format: xxxx-<ba_id>-<app_name>-(dev|prod)
  specs?: Record<string, unknown>      // variable JSON schema per product
  subApplication?: string              // user-editable label for multi-app projects
  targetResourceId?: string            // resource ID in the target environment
  syncStatus: SyncStatus
  needMigration?: boolean  // default true; false = excluded from migration scope
  jiraSubtaskKey?: string  // populated by async Jira job after sign-off
  migrationCompleted?: boolean  // project member marks resource migration as done after subtask created
}

export interface CurrentInfrastructure {
  resources: CloudResource[]
}

// ─── Section 3: Availability & Resilience ────────────────────────────────────

export interface AvailabilityResilience {
  rto: string
  rpo: string
  azReadiness3Az?: string
  healthCheckEndpoints?: string[]
}

// ─── Section 4: Data & Persistence ──────────────────────────────────────────

export interface DataPersistence {
  databaseTypes: string[]
  totalDataVolume?: string
  dataGrowthRate?: string
  backupRequiredDuringMigration?: boolean
  lastRestoreTest?: string             // URL to BRETT restore test report
  dataResidency?: string
  encryptionAtRest?: string
  statefulComponents?: string[]
}

// ─── Section 5: Dependencies ─────────────────────────────────────────────────

export interface DependencyEntry {
  id: string
  name: string
  baId?: string
  contactEmail?: string
  hosting?: string    // e.g. "AliCloud", "On-Premise"
  notes?: string
}

export interface Dependencies {
  upstream: DependencyEntry[]
  downstream: DependencyEntry[]
}

// ─── Section 6: Non-Functional Requirements ──────────────────────────────────

export interface NonFunctionalRequirements {
  peakLoad: string
  autoscaling: string
  licensing: string
}

// ─── Section 7: Migration Constraints ────────────────────────────────────────

export interface DateRangeEntry {
  name: string
  from: string   // ISO date string e.g. '2024-12-20'
  to?: string    // ISO date string, optional (omit for single-day)
}

export interface MigrationConstraints {
  regularMigrationWindow: string
  preferredMigrationWindow?: ('weekday' | 'weekend')[]
  earliestStartDate?: string
  latestEndDate?: string
  crDurationHours?: number
  snowCiGroups?: string[]
  changeFreezePeriods?: DateRangeEntry[]
}

// ─── Section 7.5: Data Migration Schedule ────────────────────────────────────

export type DataMigrationCycleCountOption = 'min' | 'more'

export interface DataMigrationSchedule {
  startDate?: string
  endDate?: string
  cycleBlocks?: { startDate: string; endDate: string }[]
  cycleCount?: number
  cycleCountOption?: DataMigrationCycleCountOption
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

// ─── Section 8: Target Architecture ─────────────────────────────────────────

export interface TargetArchitecture {
  reArchitectureNeeded?: boolean
  topology3Az?: string
  dnsIpChanges?: string
  newServicesRequired?: string[]
  architectureDiagram?: string
}

// ─── Section 8.5: Migration Effort Estimation ────────────────────────────────

export interface EffortTask {
  effortType: string
  effort?: number        // Effort Unit (FTE)
  effortTime?: number    // Effort Time (Month)
  rate?: number          // Rate (Monthly Cost USD)
  thirdParty?: boolean
  remarks?: string
}

export interface EffortTable {
  baId?: string
  tasks: EffortTask[]
}

export interface MigrationEffortEstimation {
  effortEstimate?: string
  notes?: string
  attachmentIds?: string[]
  tables?: EffortTable[]
  tableMode?: 'single' | 'multiple'
}

// ─── Section 8.6: Engagement ────────────────────────────────────────────────

export type EngagementStatus = 'pending' | 'scheduled' | 'waiting_confirmation' | 'completed' | 'cancelled' | 'no_show' | 'no_demand'

export interface EngagementSlot {
  id: string
  start: string   // ISO datetime
  end: string     // ISO datetime
  isActual?: boolean
}

export interface Engagement {
  status: EngagementStatus
  interviewSubject?: string
  plannedSlots: EngagementSlot[]
  participantIds: string[]
  engagementReviewerIds: string[]
  engagementManagerId?: string
  notes?: unknown[] | string
  confluencePageId?: string
  confluencePageUrl?: string
  zoomMeetingUrl?: string
  zoomMeetingId?: string
}

// ─── Section 9: Risks & Blockers ─────────────────────────────────────────────

export interface Risk {
  id: string
  title: string
  description: string
  severity: RiskSeverity
  mitigation?: string
  owner?: string
  riskStatus?: string
}

// ─── Section 10: Sign-off (via Approval[]) ───────────────────────────────────

export interface Approval {
  id: string
  role: string
  approver?: string
  status: ApprovalStatus
  timestamp?: string
  icon: string
  userId?: string
}

// ─── Wave planning milestones ─────────────────────────────────────────────────

export type MilestoneType = 'env-provision' | 'dev-resource-provision' | 'dev-data-migration' | 'dev-cutover' | 'prd-resource-provision' | 'prd-data-migration' | 'prd-cutover' | 'custom' | 'category-milestone' | 'data-migration-period'
export type MilestoneStatus = 'todo' | 'in-progress' | 'done'

export interface MilestoneComment {
  id: string
  text: string
  author: string
  createdAt: string   // ISO 8601
}

export interface PlanningMilestone {
  id: string           // '<type>-<projectId>' for preset milestones; random UUID for custom
  name: string
  type: MilestoneType
  start: string      // ISO date
  end: string        // ISO date
  status: MilestoneStatus
  deps: string[]     // other PlanningMilestone ids
  immutable?: boolean
  comments?: MilestoneComment[]
}

export interface ProjectPlanning {
  /** Derived automatically from the union of the project's milestones (persisted +
   *  auto-derived env-provision / data-migration period + category milestone overrides).
   *  Cached here so backend scoring, reports and Jira sync can consume it. */
  startDate: string
  endDate: string
  milestones: PlanningMilestone[]
  /** Ordered ids of all rendered milestone rows (category + env + data-migration + persisted).
   *  Category milestone ids are pinned to the top; missing rows' ids are ignored at render. */
  milestoneRowOrder?: string[]
  /** Per-project overrides for assigned category milestones (cmId → dates + status) */
  categoryMilestoneOverrides?: Record<string, { start: string; end: string; status?: MilestoneStatus }>
}

// ─── Note Template ───────────────────────────────────────────────────────────

export interface NoteTemplate {
  id: string
  name: string
  description?: string
  labels: string[]
  blocks: unknown[]
  scope: 'global' | 'private' | 'function'
  sharedRoles?: string[]
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface NoteTemplateVersion {
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

// ─── Project ─────────────────────────────────────────────────────────────────

export interface StageProgress {
  setup: number      // 0 or 100
  survey: number     // 0 or 100
  signoff: number    // 0, 33, 67, or 100
  migration: number  // 0–100
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  blockedReason?: string
  progress: number
  stageProgress?: StageProgress
  surveySubmittedAt?: string
  isSurveyNeeded?: boolean
  justificationWithoutSurvey?: string
  team: TeamMember[]
  description?: string
  bgi_id?: string
  // Header metadata
  migrationWave?: string
  itso?: string
  itsoEmail?: string
  itsoDelegate?: string
  itsoDelegateEmail?: string
  jiraBaseUrl?: string              // e.g. "https://your-org.atlassian.net", returned by backend API
  updatedAt?: string
  // Register sections
  applicationOverview?: ApplicationOverview
  governanceRoles?: GovernanceRoles
  currentInfrastructure?: CurrentInfrastructure
  availability?: AvailabilityResilience
  dataPersistence?: DataPersistence
  dependencies?: Dependencies
  nfrs?: NonFunctionalRequirements
  migrationConstraints?: MigrationConstraints
  dataMigrationSchedule?: DataMigrationSchedule
  dataMigrationPlan?: DataMigrationSchedule
  dataMigrationSurveySubmittedAt?: string
  dataMigrationSurveySubmittedBy?: string
  targetArchitecture?: TargetArchitecture
  migrationEffortEstimation?: MigrationEffortEstimation
  engagement?: Engagement
  risks: Risk[]
  approvals: Approval[]
  // Wave planning
  waveId?: string              // references Wave.id; takes precedence over migrationWave for display
  planning?: ProjectPlanning   // Gantt-managed planning blob (dates + tasks)
  environmentProvision?: EnvironmentProvision
  jiraSubtaskConfig?: JiraSubtaskConfig
  jiraStoryKey?: string        // e.g. "MIG-42", populated by async Jira job
  jiraJobStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  categoryMilestoneIds?: string[]
  // Lean fields
  resourceSets?: string[]      // deduplicated resource_set values from cloud_resources
}

// ─── Projects table (lean, paginated) ─────────────────────────────────────────

/** Trimmed application overview — only the keys the projects table renders. */
export type ProjectTableOverview = Pick<
  ApplicationOverview,
  'newProjectId' | 'applicationName' | 'baId' | 'systemImportanceClassification' | 'iitaApplicability' | 'migrationStrategy'
>

/**
 * Lean project payload returned by GET /api/v1/projects/table.
 * Contains only what the projects table columns render; scores are precomputed
 * server-side (see backend/app/services/scoring_service.py).
 */
export interface ProjectTableRow {
  id: string
  name: string
  status: ProjectStatus
  progress: number
  stageProgress?: StageProgress
  surveySubmittedAt?: string
  dataMigrationSurveySubmittedAt?: string
  hasSurveyDraft: boolean
  bgi_id?: string
  itso?: string
  itsoDelegate?: string
  gbiChampion?: string
  gbiChampionDelegate?: string
  jiraStoryKey?: string
  jiraBaseUrl?: string
  isSurveyNeeded?: boolean
  justificationWithoutSurvey?: string
  applicationOverview?: ProjectTableOverview
  planning?: { startDate?: string; endDate?: string }
  migrationConstraints?: Pick<MigrationConstraints, 'earliestStartDate' | 'latestEndDate'>
  migrationEffortEstimation?: MigrationEffortEstimation
  infraFootprint: InfraFootprintResult
  migrationDriver: MigrationDriverResult
}

export interface ProjectTablePage {
  items: ProjectTableRow[]
  total: number
  page: number
  pageSize: number
}

// ─── Dashboard / Home ─────────────────────────────────────────────────────────

export interface Activity {
  id: string
  type: ActivityType
  message: string
  time: string
  actor: string
  projectId?: string
  projectName?: string
}

export interface OverallStats {
  progress: number
  totalAssets: number
  targetCloud: string
  completed: number
  inProgress: number
}
