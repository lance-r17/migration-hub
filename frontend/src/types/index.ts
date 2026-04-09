import type { JiraSubtaskConfig } from './wave'
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
  role?: string
}

export interface ProjectUsers {
  projectId: string
  userIds: string[]
}

// ─── Section 1: Application Overview ────────────────────────────────────────

export type MigrationStrategy = 'Lift & Shift' | 'Refactor' | 'Deboard'

export interface ApplicationOverview {
  applicationName: string
  shortName?: string
  businessOwnerId?: string    // User.id
  technicalLeadId?: string    // User.id
  dbaDataOwnerId?: string     // User.id
  businessFunction?: string
  userBase?: {
    type: 'Internal' | 'External' | 'Both'
    count?: string
  }
  applicationTier?: ApplicationTier
  eimId?: string
  ibsInScope?: boolean
  migrationStrategy?: MigrationStrategy
  serviceLine?: string
}

// ─── Section 2: Current Infrastructure ──────────────────────────────────────

export type ResourceCategory = 'VM' | 'Database' | 'Buckets' | 'Network' | 'Other'

export interface ProductCategoryEntry {
  product: string
  category: ResourceCategory
}

export interface CloudResource {
  id: string
  resourceId?: string                  // e.g. "i-abc1234"
  name: string
  product?: string                     // e.g. "ecs", "polarDB", "rds", "oss", "sls", "slb", "dns"
  resourceSet?: string                 // format: xxxx-<eim_id>-<app_name>-(dev|prod)
  specs?: Record<string, unknown>      // variable JSON schema per product
  subApplication?: string              // user-editable label for multi-app projects
  targetResourceId?: string            // resource ID in the target environment
  syncStatus: SyncStatus
  needMigration?: boolean  // default true; false = excluded from migration scope
  jiraSubtaskKey?: string  // populated by async Jira job after sign-off
}

export interface NetworkConfig {
  loadBalancerType?: string
  vipDnsNames?: string[]
  firewallZones?: string[]
  bandwidthRequirements?: string
  hardcodedIps?: boolean
  privateConnectivity?: string
}

export interface CurrentInfrastructure {
  resources: CloudResource[]
  network?: NetworkConfig
}

// ─── Section 3: Availability & Resilience ────────────────────────────────────

export interface AvailabilityResilience {
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

// ─── Section 4: Data & Persistence ──────────────────────────────────────────

export interface DataPersistence {
  databaseTypes: string[]
  totalDataVolume?: string
  dataGrowthRate?: string
  replicationTopology?: string
  backupMethod?: string
  backupRequiredDuringMigration?: boolean
  lastRestoreTest?: string             // URL to BRETT restore test report
  dataResidency?: string
  encryptionAtRest?: string
  piiData?: boolean
  statefulComponents?: string[]
}

// ─── Section 5: Dependencies ─────────────────────────────────────────────────

export interface DependencyEntry {
  id: string
  name: string
  eimId?: string
  contactEmail?: string
  hosting?: string    // e.g. "AliCloud", "On-Premise"
  notes?: string
}

export interface CertificatesSecrets {
  tlsCertificates?: string
  secretsManagement?: string
  apiKeys?: string
}

export interface Dependencies {
  upstream: DependencyEntry[]
  downstream: DependencyEntry[]
  certificatesSecrets?: CertificatesSecrets
}

// ─── Section 6: Non-Functional Requirements ──────────────────────────────────

export interface NonFunctionalRequirements {
  peakLoad: string
  autoscaling: string
  seasonalPatterns: string
  latencySensitivity: string
  monitoring: string
  logAggregation: string
  compliance: string[]
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
  blackoutDates: DateRangeEntry[]
  changeFreezePeriods?: DateRangeEntry[]
  maxCutoverWindow?: string
  cutoverApproach: string
  rollbackPlan: string
  stakeholderComms: string
  preMigrationTesting: string
}

// ─── Section 8: Target Architecture ─────────────────────────────────────────

export interface TargetArchitecture {
  summary: string
  constraints: string
  reArchitectureNeeded?: boolean
  topology3Az?: string
  replicationChanges?: string
  dnsIpChanges?: string
  newServicesRequired?: string[]
  architectureDiagram?: string
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

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  progress: number
  team: TeamMember[]
  description?: string
  // Header metadata
  migrationWave?: string
  profileOwner?: string
  jiraTicket?: string
  jiraBaseUrl?: string              // e.g. "https://your-org.atlassian.net", returned by backend API
  lastUpdated?: string
  // Register sections
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
  waveId?: string              // references Wave.id; takes precedence over migrationWave for display
  jiraSubtaskConfig?: JiraSubtaskConfig
  jiraStoryKey?: string        // e.g. "MIG-42", populated by async Jira job
  jiraJobStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}

// ─── Dashboard / Home ─────────────────────────────────────────────────────────

export interface Activity {
  id: string
  type: ActivityType
  message: string
  time: string
  actor: string
  projectId?: string
}

export interface OverallStats {
  progress: number
  totalAssets: number
  targetCloud: string
  completed: number
  inProgress: number
}
