export type ProjectStatus = 'migrating' | 'signed-off' | 'blocked' | 'planning' | 'in-progress' | 'completed'
export type ApprovalStatus = 'approved' | 'pending' | 'waiting'
export type RiskSeverity = 'critical' | 'medium' | 'low'
export type SyncStatus = 'synced' | 'out-of-sync' | 'provisioning'
export type ActivityType = 'success' | 'info' | 'error'
export type ApplicationTier = 'P1' | 'P2' | 'P3'

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
}

// ─── Section 2: Current Infrastructure ──────────────────────────────────────

export interface CloudResource {
  id: string
  name: string
  category: 'VM' | 'Database' | 'Buckets' | 'Network' | 'Other'
  existingStatus: string
  targetStatus: string
  syncStatus: SyncStatus
  specs?: string
  quantity?: number
  availabilityZones?: string[]
  needMigration?: boolean  // default true; false = excluded from migration scope
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
  lastRestoreTest?: string
  dataResidency?: string
  encryptionAtRest?: string
  piiData?: boolean
  statefulComponents?: string[]
}

// ─── Section 5: Dependencies ─────────────────────────────────────────────────

export interface DependencyEntry {
  id: string
  name: string
  protocol?: string
  port?: string
  access?: 'Internal' | 'External'
  owner?: string
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
  migrationWindow: string
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
}

// ─── Dashboard / Home ─────────────────────────────────────────────────────────

export interface Activity {
  id: string
  type: ActivityType
  message: string
  time: string
  actor: string
}

export interface OverallStats {
  progress: number
  totalAssets: number
  targetCloud: string
  completed: number
  inProgress: number
}
