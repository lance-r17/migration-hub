import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type {
  Project,
  ProjectTableOverview,
  ProjectTablePage,
  ProjectTableRow,
  StageProgress,
  ProjectPlanning,
  TeamMember,
  ApplicationOverview,
  ApplicationTier,
  EnvironmentProvision,
  AvailabilityResilience,
  DataPersistence,
  Dependencies,
  NonFunctionalRequirements,
  MigrationConstraints,
  TargetArchitecture,
  MigrationEffortEstimation,
  Engagement,
  CloudResource,
  Risk,
  Approval,
  DataMigrationSchedule,
} from '@/types'
import {
  getInfraFootprintScore,
  getMigrationDriverScore,
  type InfraFootprintLevel,
  type InfraFootprintResult,
  type MigrationDriverLevel,
  type MigrationDriverResult,
} from '@/lib/scoring'
import type { JiraSubtaskConfig } from '@/types/wave'

/**
 * Normalizes legacy environment provision blobs ({ date, environments: ['dev'|'prod'], completedAt })
 * into the split per-environment shape. Legacy date/completedAt are copied into each checked env.
 */
function normalizeEnvironmentProvision(raw: EnvironmentProvision | null): EnvironmentProvision | undefined {
  if (!raw) return undefined
  const obj = raw as EnvironmentProvision & {
    date?: string
    environments?: ('dev' | 'prod')[]
    completedAt?: string | null
  }
  if (!('dev' in obj) && !('prod' in obj) && !('environments' in obj) && !('date' in obj)) return undefined
  if ('dev' in obj || 'prod' in obj) {
    const result: EnvironmentProvision = {}
    if (obj.dev) result.dev = obj.dev
    if (obj.prod) result.prod = obj.prod
    return Object.keys(result).length ? result : undefined
  }
  const result: EnvironmentProvision = {}
  for (const env of obj.environments ?? []) {
    if (env !== 'dev' && env !== 'prod') continue
    result[env] = { date: obj.date, completedAt: obj.completedAt ?? null }
  }
  return Object.keys(result).length ? result : undefined
}

const ENDPOINTS = {
  projects: '/api/v1/projects',
  project: (id: string) => `/api/v1/projects/${id}`,
  surveyNeed: (id: string) => `/api/v1/projects/${id}/survey-need`,
  section: (id: string, key: string) => `/api/v1/projects/${id}/sections/${key}`,
  planning: (id: string) => `/api/v1/projects/${id}/planning`,
  surveySubmitted: (id: string) => `/api/v1/projects/${id}/survey-submitted`,
  surveyDraft: (id: string) => `/api/v1/projects/${id}/survey-draft`,
  dataMigrationSurveySubmitted: (id: string) => `/api/v1/projects/${id}/data-migration-survey-submitted`,
  dataMigrationComplete: (id: string) => `/api/v1/projects/${id}/data-migration-complete`,
  dataMigrationReopen: (id: string) => `/api/v1/projects/${id}/data-migration-reopen`,
  dataMigrationCycleBlocks: '/api/v1/projects/data-migration-cycle-blocks',
  resourceSyncComplete: (projectId: string, resourceId: string) => `/api/v1/projects/${projectId}/resources/${resourceId}/sync-complete`,
}

// ─── Raw API shapes (snake_case, matching backend schemas) ────────────────────

interface CloudResourceApi {
  resource_id: string
  project_id: string
  name: string
  product: string | null
  resource_set: string | null
  specs: Record<string, unknown> | null
  sub_application: string | null
  target_resource_id: string | null
  sync_status: string
  need_migration: boolean
  migration_completed: boolean
  jira_subtask_key: string | null
}

interface RiskApi {
  id: string
  project_id: string
  title: string
  description: string
  severity: string
  mitigation: string | null
  owner: string | null
  risk_status: string | null
}

interface ApprovalApi {
  id: string
  project_id: string
  role: string
  approver: string | null
  status: string
  timestamp: string | null
  icon: string
  user_id: string | null
}

interface ProjectListItemApi {
  id: string
  name: string
  status: string
  blocked_reason: string | null
  progress: number
  stage_progress: StageProgress | null
  survey_submitted_at: string | null
  team: TeamMember[]
  description: string | null
  migration_wave: string | null
  itso: string | null
  itso_email: string | null
  itso_delegate: string | null
  itso_delegate_email: string | null
  jira_base_url: string | null
  updated_at: string | null
  wave_id: string | null
  jira_story_key: string | null
  jira_job_status: string | null
  planning: ProjectPlanning | null
  is_survey_needed: boolean
  justification_without_survey: string | null
  migration_constraints: MigrationConstraints | null
  migration_effort_estimation: MigrationEffortEstimation | null
  data_migration_schedule: DataMigrationSchedule | null
  data_migration_plan: DataMigrationSchedule | null
  environment_provision: EnvironmentProvision | null
  data_migration_survey_submitted_at: string | null
  data_migration_survey_submitted_by: string | null
  application_overview: ApplicationOverview | null
  dependencies: Dependencies | null
  governance_roles: GovernanceRolesApi | null
  availability: AvailabilityResilience | null
  data_persistence: DataPersistence | null
  nfrs: NonFunctionalRequirements | null
  target_architecture: TargetArchitecture | null
  engagement: Engagement | null
  approvals: ApprovalApi[]
  cloud_resources: CloudResourceApi[]
  resource_sets: string[] | null
  risks: RiskApi[]
  bgi_id: string | null
  category_milestone_ids: string[] | null
}

interface GovernanceRolesApi {
  technical_lead: { id: string; name: string; email: string; department: string; initials: string } | null
  business_owner: { id: string; name: string; email: string; department: string; initials: string } | null
  dba_data_owner: { id: string; name: string; email: string; department: string; initials: string } | null
  gbi_champion: { id: string; name: string; email: string; department: string; initials: string } | null
  gbi_champion_delegate: { id: string; name: string; email: string; department: string; initials: string } | null
}

interface ProjectApiResponse extends ProjectListItemApi {
  blocked_reason: string | null
  jira_subtask_config: JiraSubtaskConfig | null
  governance_roles: GovernanceRolesApi | null
  application_overview: ApplicationOverview | null
  availability: AvailabilityResilience | null
  data_persistence: DataPersistence | null
  dependencies: Dependencies | null
  nfrs: NonFunctionalRequirements | null
  migration_constraints: MigrationConstraints | null
  target_architecture: TargetArchitecture | null
  migration_effort_estimation: MigrationEffortEstimation | null
  data_migration_schedule: DataMigrationSchedule | null
  data_migration_plan: DataMigrationSchedule | null
  environment_provision: EnvironmentProvision | null
  data_migration_survey_submitted_at: string | null
  data_migration_survey_submitted_by: string | null
  engagement: Engagement | null
  cloud_resources: CloudResourceApi[]
  risks: RiskApi[]
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapResource(r: CloudResourceApi): CloudResource {
  return {
    resourceId: r.resource_id,
    name: r.name,
    product: r.product ?? undefined,
    resourceSet: r.resource_set ?? undefined,
    specs: r.specs ?? undefined,
    subApplication: r.sub_application ?? undefined,
    targetResourceId: r.target_resource_id ?? undefined,
    syncStatus: r.sync_status as CloudResource['syncStatus'],
    needMigration: r.need_migration,
    migrationCompleted: r.migration_completed,
    jiraSubtaskKey: r.jira_subtask_key ?? undefined,
  }
}

function mapRisk(r: RiskApi): Risk {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    severity: r.severity as Risk['severity'],
    mitigation: r.mitigation ?? undefined,
    owner: r.owner ?? undefined,
    riskStatus: r.risk_status ?? undefined,
  }
}

function mapApproval(a: ApprovalApi): Approval {
  return {
    id: a.id,
    role: a.role,
    approver: a.approver ?? undefined,
    status: a.status as Approval['status'],
    timestamp: a.timestamp ?? undefined,
    icon: a.icon,
    userId: a.user_id ?? undefined,
  }
}

function fromApiListItem(raw: ProjectListItemApi): Project {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status as Project['status'],
    blockedReason: raw.blocked_reason ?? undefined,
    progress: raw.progress,
    team: raw.team ?? [],
    description: raw.description ?? undefined,
    migrationWave: raw.migration_wave ?? undefined,
    itso: raw.itso ?? undefined,
    itsoEmail: raw.itso_email ?? undefined,
    itsoDelegate: raw.itso_delegate ?? undefined,
    itsoDelegateEmail: raw.itso_delegate_email ?? undefined,
    jiraBaseUrl: raw.jira_base_url ?? undefined,
    updatedAt: raw.updated_at ?? undefined,
    waveId: raw.wave_id ?? undefined,
    jiraStoryKey: raw.jira_story_key ?? undefined,
    jiraJobStatus: raw.jira_job_status as Project['jiraJobStatus'] ?? undefined,
    planning: raw.planning ?? undefined,
    surveySubmittedAt: raw.survey_submitted_at ?? undefined,
    isSurveyNeeded: raw.is_survey_needed ?? true,
    justificationWithoutSurvey: raw.justification_without_survey ?? undefined,
    stageProgress: raw.stage_progress ?? undefined,
    migrationConstraints: raw.migration_constraints ?? undefined,
    migrationEffortEstimation: raw.migration_effort_estimation ?? undefined,
    environmentProvision: normalizeEnvironmentProvision(raw.environment_provision),
    dataMigrationSchedule: raw.data_migration_schedule ?? undefined,
    dataMigrationPlan: raw.data_migration_plan ?? undefined,
    dataMigrationSurveySubmittedAt: raw.data_migration_survey_submitted_at ?? undefined,
    dataMigrationSurveySubmittedBy: raw.data_migration_survey_submitted_by ?? undefined,
    applicationOverview: raw.application_overview ?? undefined,
    dependencies: raw.dependencies ?? undefined,
    governanceRoles: mapGovernanceRoles(raw.governance_roles),
    availability: raw.availability ?? undefined,
    dataPersistence: raw.data_persistence ?? undefined,
    nfrs: raw.nfrs ?? undefined,
    targetArchitecture: raw.target_architecture ?? undefined,
    engagement: raw.engagement ?? undefined,
    risks: (raw.risks ?? []).map(mapRisk),
    approvals: (raw.approvals ?? []).map(mapApproval),
    currentInfrastructure: raw.cloud_resources?.length
      ? { resources: raw.cloud_resources.map(mapResource) }
      : undefined,
    resourceSets: raw.resource_sets ?? undefined,
    bgi_id: raw.bgi_id ?? undefined,
    categoryMilestoneIds: raw.category_milestone_ids ?? undefined,
  }
}

function mapGovernanceRoles(raw: GovernanceRolesApi | null): Project['governanceRoles'] {
  if (!raw) return undefined
  return {
    technicalLead: raw.technical_lead ?? undefined,
    businessOwner: raw.business_owner ?? undefined,
    dbaDataOwner: raw.dba_data_owner ?? undefined,
    gbiChampion: raw.gbi_champion ?? undefined,
    gbiChampionDelegate: raw.gbi_champion_delegate ?? undefined,
  }
}

function fromApi(raw: ProjectApiResponse): Project {
  return {
    ...fromApiListItem(raw),
    jiraSubtaskConfig: raw.jira_subtask_config ?? undefined,
    governanceRoles: mapGovernanceRoles(raw.governance_roles),
    applicationOverview: raw.application_overview ?? undefined,
    availability: raw.availability ?? undefined,
    dataPersistence: raw.data_persistence ?? undefined,
    dependencies: raw.dependencies ?? undefined,
    nfrs: raw.nfrs ?? undefined,
    migrationConstraints: raw.migration_constraints ?? undefined,
    targetArchitecture: raw.target_architecture ?? undefined,
    migrationEffortEstimation: raw.migration_effort_estimation ?? undefined,
    environmentProvision: normalizeEnvironmentProvision(raw.environment_provision),
    dataMigrationSchedule: raw.data_migration_schedule ?? undefined,
    dataMigrationPlan: raw.data_migration_plan ?? undefined,
    dataMigrationSurveySubmittedAt: raw.data_migration_survey_submitted_at ?? undefined,
    dataMigrationSurveySubmittedBy: raw.data_migration_survey_submitted_by ?? undefined,
    engagement: raw.engagement ?? undefined,
    currentInfrastructure: raw.cloud_resources?.length
      ? { resources: raw.cloud_resources.map(mapResource) }
      : undefined,
    risks: (raw.risks ?? []).map(mapRisk),
    approvals: (raw.approvals ?? []).map(mapApproval),
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

function buildFieldsQs(fields?: string[]): string {
  if (!fields || fields.length === 0) return ''
  return fields.map(f => `fields=${encodeURIComponent(f)}`).join('&')
}

export async function getProjects(fields?: string[]): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjects() }
  const qs = buildFieldsQs(fields)
  const items = await apiClient.get<ProjectListItemApi[]>(`${ENDPOINTS.projects}${qs ? `?${qs}` : ''}`)
  return items.map(fromApiListItem)
}

export async function getProjectsForUser(userId: string, fields?: string[]): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjectsForUser(userId) }
  const qs = buildFieldsQs(fields)
  const items = await apiClient.get<ProjectListItemApi[]>(`${ENDPOINTS.projects}?userId=${userId}${qs ? `&${qs}` : ''}`)
  return items.map(fromApiListItem)
}

export async function getProjectsHome(fields?: string[]): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjects() }
  const qs = buildFieldsQs(fields)
  const items = await apiClient.get<ProjectListItemApi[]>(`${ENDPOINTS.projects}/home${qs ? `?${qs}` : ''}`)
  return items.map(fromApiListItem)
}

export async function getProjectsHomeForUser(userId: string, fields?: string[]): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjectsForUser(userId) }
  const qs = buildFieldsQs(fields)
  const items = await apiClient.get<ProjectListItemApi[]>(`${ENDPOINTS.projects}/home?userId=${userId}${qs ? `&${qs}` : ''}`)
  return items.map(fromApiListItem)
}

// ─── Projects table (lean, paginated) ────────────────────────────────────────

interface InfraFootprintScoreApi {
  score: InfraFootprintLevel | null
  ecs_count: number
  ecs_level: InfraFootprintLevel | null
  data_volume_tb: number
  data_volume_level: InfraFootprintLevel | null
  maxcompute_count: number
  maxcompute_level: InfraFootprintLevel | null
}

interface MigrationDriverScoreApi {
  score: MigrationDriverLevel | null
  tier_level: MigrationDriverLevel | null
  application_tier: ApplicationTier | null
  iita_applicability: boolean | null
  third_party_effort: number
  third_party_level: MigrationDriverLevel | null
  dependency_count: number
  dependency_level: MigrationDriverLevel | null
  external_user_count: number
  external_user_level: MigrationDriverLevel | null
  internal_user_count: number
  internal_user_level: MigrationDriverLevel | null
  app_count: number
  app_level: MigrationDriverLevel | null
}

interface ProjectTableRowApi {
  id: string
  name: string
  status: string
  progress: number
  stage_progress: StageProgress | null
  survey_submitted_at: string | null
  data_migration_survey_submitted_at: string | null
  has_survey_draft: boolean
  bgi_id: string | null
  itso: string | null
  itso_delegate: string | null
  gbi_champion: string | null
  gbi_champion_delegate: string | null
  jira_story_key: string | null
  jira_base_url: string | null
  is_survey_needed: boolean
  justification_without_survey: string | null
  application_overview: ProjectTableOverview | null
  planning: { startDate?: string; endDate?: string } | null
  migration_constraints: { earliestStartDate?: string; latestEndDate?: string } | null
  migration_effort_estimation: MigrationEffortEstimation | null
  infra_footprint: InfraFootprintScoreApi
  migration_driver: MigrationDriverScoreApi
}

interface ProjectTablePageApi {
  items: ProjectTableRowApi[]
  total: number
  page: number
  page_size: number
}

function mapInfraFootprintScore(raw: InfraFootprintScoreApi): InfraFootprintResult {
  return {
    score: raw.score,
    ecsCount: raw.ecs_count,
    ecsLevel: raw.ecs_level,
    dataVolumeTb: raw.data_volume_tb,
    dataVolumeLevel: raw.data_volume_level,
    maxcomputeCount: raw.maxcompute_count,
    maxcomputeLevel: raw.maxcompute_level,
  }
}

function mapMigrationDriverScore(raw: MigrationDriverScoreApi): MigrationDriverResult {
  return {
    score: raw.score,
    tierLevel: raw.tier_level,
    applicationTier: raw.application_tier ?? undefined,
    iitaApplicability: raw.iita_applicability ?? undefined,
    thirdPartyEffort: raw.third_party_effort,
    thirdPartyLevel: raw.third_party_level,
    dependencyCount: raw.dependency_count,
    dependencyLevel: raw.dependency_level,
    externalUserCount: raw.external_user_count,
    externalUserLevel: raw.external_user_level,
    internalUserCount: raw.internal_user_count,
    internalUserLevel: raw.internal_user_level,
    appCount: raw.app_count,
    appLevel: raw.app_level,
  }
}

function fromApiTableRow(raw: ProjectTableRowApi): ProjectTableRow {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status as ProjectTableRow['status'],
    progress: raw.progress,
    stageProgress: raw.stage_progress ?? undefined,
    surveySubmittedAt: raw.survey_submitted_at ?? undefined,
    dataMigrationSurveySubmittedAt: raw.data_migration_survey_submitted_at ?? undefined,
    hasSurveyDraft: raw.has_survey_draft,
    bgi_id: raw.bgi_id ?? undefined,
    itso: raw.itso ?? undefined,
    itsoDelegate: raw.itso_delegate ?? undefined,
    gbiChampion: raw.gbi_champion ?? undefined,
    gbiChampionDelegate: raw.gbi_champion_delegate ?? undefined,
    jiraStoryKey: raw.jira_story_key ?? undefined,
    jiraBaseUrl: raw.jira_base_url ?? undefined,
    isSurveyNeeded: raw.is_survey_needed,
    justificationWithoutSurvey: raw.justification_without_survey ?? undefined,
    applicationOverview: raw.application_overview ?? undefined,
    planning: raw.planning ?? undefined,
    migrationConstraints: raw.migration_constraints ?? undefined,
    migrationEffortEstimation: raw.migration_effort_estimation ?? undefined,
    infraFootprint: mapInfraFootprintScore(raw.infra_footprint),
    migrationDriver: mapMigrationDriverScore(raw.migration_driver),
  }
}

export interface ProjectsTableParams {
  page: number
  /** 0 returns all matching rows (used by export) */
  pageSize: number
  status?: string
  search?: string
  migrationRange?: string
  /** Filter: projects where this user holds this role (itso, itso_delegate, gbi_champion, gbi_champion_delegate) */
  role?: string
  roleUserId?: string
  bgiIds?: string[] | null
}

function mockTableRow(p: Project): ProjectTableRow {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    progress: p.progress,
    stageProgress: p.stageProgress,
    surveySubmittedAt: p.surveySubmittedAt,
    dataMigrationSurveySubmittedAt: p.dataMigrationSurveySubmittedAt,
    hasSurveyDraft: false,
    bgi_id: p.bgi_id,
    itso: p.itso,
    itsoDelegate: p.itsoDelegate,
    gbiChampion: p.governanceRoles?.gbiChampion?.name,
    gbiChampionDelegate: p.governanceRoles?.gbiChampionDelegate?.name,
    jiraStoryKey: p.jiraStoryKey,
    jiraBaseUrl: p.jiraBaseUrl,
    isSurveyNeeded: p.isSurveyNeeded,
    justificationWithoutSurvey: p.justificationWithoutSurvey,
    applicationOverview: p.applicationOverview,
    planning: mockDerivedProjectDates(p) ?? (p.planning ? { startDate: p.planning.startDate, endDate: p.planning.endDate } : undefined),
    migrationConstraints: p.migrationConstraints,
    migrationEffortEstimation: p.migrationEffortEstimation,
    infraFootprint: getInfraFootprintScore(p),
    migrationDriver: getMigrationDriverScore(p),
  }
}

/** Mirrors backend get_derived_project_dates — union of the project's milestone date ranges. */
function mockDerivedProjectDates(p: Project): { startDate: string; endDate: string } | null {
  const starts: string[] = []
  const ends: string[] = []
  const push = (s?: string, e?: string) => { if (s && e) { starts.push(s); ends.push(e) } }
  const assigned = new Set(p.categoryMilestoneIds ?? [])
  for (const m of p.planning?.milestones ?? []) if (!assigned.has(m.id)) push(m.start, m.end)
  for (const env of ['dev', 'prod'] as const) {
    const d = p.environmentProvision?.[env]?.date
    if (d) push(d, d)
  }
  const dm = p.dataMigrationPlan ?? p.dataMigrationSchedule
  push(dm?.startDate, dm?.endDate)
  for (const b of dm?.cycleBlocks ?? []) push(b.startDate, b.endDate)
  for (const cmId of assigned) {
    const cm = store.getCategoryMilestones().find(c => c.id === cmId)
    const ov = p.planning?.categoryMilestoneOverrides?.[cmId]
    push(ov?.start || cm?.startDate, ov?.end || cm?.endDate)
  }
  if (!starts.length) return null
  return { startDate: starts.sort()[0], endDate: ends.sort()[ends.length - 1] }
}

function mockMigrationPeriodDays(p: Project): number | null {
  const derived = mockDerivedProjectDates(p)
  let start = derived?.startDate
  let end = derived?.endDate
  if (!start || !end) {
    start = p.planning?.startDate || p.migrationConstraints?.earliestStartDate
    end = p.planning?.endDate || p.migrationConstraints?.latestEndDate
  }
  if ((!start || !end) && p.waveId) {
    const wave = store.getWaves().find(w => w.id === p.waveId)
    start = wave?.startDate
    end = wave?.cutoverDate
  }
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
}

/** Mock mirror of backend _project_has_role_user. Mock data stores governance roles on the
 *  project (with user ids) and ITSO names as free-text strings. */
function mockProjectHasRoleUser(p: Project, role: string, userId: string): boolean {
  const user = store.getUsers().find(u => u.id === userId)
  if (!user) return false
  switch (role) {
    case 'gbi_champion': return p.governanceRoles?.gbiChampion?.id === userId
    case 'gbi_champion_delegate': return p.governanceRoles?.gbiChampionDelegate?.id === userId
    case 'itso': return !!p.itso && p.itso.startsWith(user.name)
    case 'itso_delegate': return !!p.itsoDelegate && p.itsoDelegate.startsWith(user.name)
    default: return false
  }
}

function mockGetProjectsTable(params: ProjectsTableParams): ProjectTablePage {
  const query = (params.search ?? '').trim().toLowerCase()
  let projects = store.getProjects()
  if (params.status && params.status !== 'all') {
    projects = projects.filter((p) => {
      const sp = p.stageProgress
      if (params.status === 'drafting-survey') return false // no drafts in mock mode
      if (params.status === 'awaiting-survey')
        return p.status === 'in-progress' && sp?.setup === 100 && (sp?.survey ?? 0) < 100
      if (params.status === 'survey-submitted')
        return p.status === 'in-progress' && sp?.setup === 100 && sp?.survey === 100 && sp?.signoff === 0
      if (params.status === 'awaiting-signoff')
        return p.status === 'in-progress' && sp?.setup === 100 && sp?.survey === 100 && (sp?.signoff ?? 0) > 0 && (sp?.signoff ?? 0) < 100
      return p.status === params.status
    })
  }
  if (params.bgiIds?.length) {
    const allowed = new Set(params.bgiIds)
    projects = projects.filter((p) => p.bgi_id && allowed.has(p.bgi_id))
  }
  if (query) {
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        (p.applicationOverview?.applicationName?.toLowerCase().includes(query) ?? false) ||
        (p.applicationOverview?.baId?.toLowerCase().includes(query) ?? false),
    )
  }
  if (params.migrationRange && params.migrationRange !== 'all') {
    projects = projects.filter((p) => {
      const days = mockMigrationPeriodDays(p)
      if (days === null) return false
      switch (params.migrationRange) {
        case 'lt30': return days < 30
        case '30to90': return days >= 30 && days < 90
        case '90to180': return days >= 90 && days < 180
        case 'gte180': return days >= 180
        default: return true
      }
    })
  }
  if (params.role && params.roleUserId) {
    projects = projects.filter((p) => mockProjectHasRoleUser(p, params.role!, params.roleUserId!))
  }
  const total = projects.length
  const sliced = params.pageSize > 0
    ? projects.slice((params.page - 1) * params.pageSize, params.page * params.pageSize)
    : projects
  return { items: sliced.map(mockTableRow), total, page: params.page, pageSize: params.pageSize }
}

export async function getProjectsTable(params: ProjectsTableParams): Promise<ProjectTablePage> {
  if (USE_MOCK) {
    await delay()
    return mockGetProjectsTable(params)
  }
  const qs = new URLSearchParams()
  qs.set('page', String(params.page))
  qs.set('page_size', String(params.pageSize))
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  if (params.search?.trim()) qs.set('search', params.search.trim())
  if (params.migrationRange && params.migrationRange !== 'all') qs.set('migration_range', params.migrationRange)
  if (params.role && params.roleUserId) {
    qs.set('role', params.role)
    qs.set('role_user_id', params.roleUserId)
  }
  for (const id of params.bgiIds ?? []) qs.append('bgi_ids', id)
  const raw = await apiClient.get<ProjectTablePageApi>(`${ENDPOINTS.projects}/table?${qs.toString()}`)
  return {
    items: raw.items.map(fromApiTableRow),
    total: raw.total,
    page: raw.page,
    pageSize: raw.page_size,
  }
}

export async function getAssetStats(): Promise<Record<string, number>> {
  if (USE_MOCK) { await delay(); return {} }
  return apiClient.get<Record<string, number>>(`${ENDPOINTS.projects}/asset-stats`)
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (USE_MOCK) { await delay(); return store.getProject(id) }
  const raw = await apiClient.get<ProjectApiResponse>(ENDPOINTS.project(id))
  return fromApi(raw)
}

export async function blockProject(id: string, reason: string): Promise<Project> {
  const raw = await apiClient.patch<ProjectApiResponse>(ENDPOINTS.project(id), {
    status: 'blocked',
    blocked_reason: reason,
  })
  return fromApi(raw)
}

export async function updateProject<K extends keyof Project>(
  id: string,
  key: K,
  value: Project[K],
): Promise<Project> {
  if (USE_MOCK) { await delay(); return store.updateProject(id, key, value) }
  // Send null if value is undefined to satisfy backend validation
  const payloadValue = value === undefined ? null : value
  const raw = await apiClient.patch<ProjectApiResponse>(ENDPOINTS.section(id, String(key)), { value: payloadValue })
  return fromApi(raw)
}

export async function updateApplicationOverview(
  id: string,
  partial: Partial<ApplicationOverview>,
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(id)
    if (!p) throw new Error('Project not found')
    const updated: ApplicationOverview = { ...p.applicationOverview, ...partial }
    return store.updateProject(id, 'applicationOverview', updated)
  }
  const raw = await apiClient.patch<ProjectApiResponse>(ENDPOINTS.section(id, 'applicationOverview'), { value: partial })
  return fromApi(raw)
}

export async function updateEnvironmentProvision(
  id: string,
  provision: EnvironmentProvision,
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(id)
    if (!p) throw new Error('Project not found')
    // Replace semantics: unchecked environments are discarded (omitted from the payload)
    return store.updateProject(id, 'environmentProvision', provision)
  }
  const raw = await apiClient.patch<ProjectApiResponse>(ENDPOINTS.section(id, 'environmentProvision'), { value: provision })
  return fromApi(raw)
}

export async function updatePlanning(
  id: string,
  planning: ProjectPlanning,
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(id)
    if (!p) throw new Error('Project not found')
    return store.updateProject(id, 'planning' as keyof Project, planning as Project[keyof Project])
  }
  const raw = await apiClient.patch<ProjectApiResponse>(ENDPOINTS.planning(id), { planning })
  return fromApi(raw)
}

export async function submitSurvey(id: string): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const now = new Date().toISOString()
    store.updateProject(id, 'surveySubmittedAt', now)
    const p = store.getProject(id)!
    const current = p.stageProgress ?? { setup: 0, survey: 0, signoff: 0, migration: 0 }
    store.updateProject(id, 'stageProgress', { ...current, survey: 100 })
    return store.getProject(id)!
  }
  const raw = await apiClient.post<ProjectApiResponse>(ENDPOINTS.surveySubmitted(id), {})
  return fromApi(raw)
}

export async function markDataMigrationSurveySubmitted(id: string): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const now = new Date().toISOString()
    store.updateProject(id, 'dataMigrationSurveySubmittedAt', now)
    return store.getProject(id)!
  }
  const raw = await apiClient.post<ProjectApiResponse>(ENDPOINTS.dataMigrationSurveySubmitted(id), {})
  return fromApi(raw)
}

export interface MarkDataMigrationCompleteRequest {
  remark?: string
}

export interface ReopenDataMigrationRequest {
  reason: string
}

export async function markDataMigrationComplete(
  id: string,
  payload: MarkDataMigrationCompleteRequest,
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(id)
    if (!p) throw new Error('Project not found')
    const plan = { ...(p.dataMigrationPlan ?? {}) }
    plan.completedAt = new Date().toISOString()
    plan.completedBy = 'mock-user'
    if (payload.remark) plan.completionRemark = payload.remark
    store.updateProject(id, 'dataMigrationPlan', plan as Project['dataMigrationPlan'])
    return store.getProject(id)!
  }
  const raw = await apiClient.post<ProjectApiResponse>(ENDPOINTS.dataMigrationComplete(id), payload)
  return fromApi(raw)
}

export async function reopenDataMigration(
  id: string,
  payload: ReopenDataMigrationRequest,
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(id)
    if (!p) throw new Error('Project not found')
    const plan = { ...(p.dataMigrationPlan ?? {}) }
    plan.reopenedAt = new Date().toISOString()
    plan.reopenedBy = 'mock-user'
    plan.reopenReason = payload.reason
    delete plan.completedAt
    delete plan.completedBy
    delete plan.completionRemark
    store.updateProject(id, 'dataMigrationPlan', plan as Project['dataMigrationPlan'])
    return store.getProject(id)!
  }
  const raw = await apiClient.post<ProjectApiResponse>(ENDPOINTS.dataMigrationReopen(id), payload)
  return fromApi(raw)
}

interface DataMigrationCycleBlockApi {
  start_date: string
  end_date: string
  booked_count: number
  asr_dr_booked_count: number
}

export interface DataMigrationCycleBlock {
  startDate: string
  endDate: string
  bookedCount: number
  asrDrBookedCount: number
}

export async function getDataMigrationCycleBlocks(
  cycleStartDate: string,
  cycleEndDate: string,
  cycleDurationDays: number,
): Promise<DataMigrationCycleBlock[]> {
  if (USE_MOCK) {
    await delay()
    // Generate deterministic mock blocks
    const blocks: DataMigrationCycleBlock[] = []
    const start = new Date(cycleStartDate)
    const end = new Date(cycleEndDate)
    let current = new Date(start)
    while (current <= end) {
      const blockEnd = new Date(current)
      blockEnd.setDate(blockEnd.getDate() + cycleDurationDays - 1)
      if (blockEnd > end) blockEnd.setTime(end.getTime())
      blocks.push({
        startDate: current.toISOString().split('T')[0],
        endDate: blockEnd.toISOString().split('T')[0],
        bookedCount: Math.floor(Math.random() * 5),
        asrDrBookedCount: Math.floor(Math.random() * 3),
      })
      current = new Date(blockEnd)
      current.setDate(current.getDate() + 1)
    }
    return blocks
  }
  const items = await apiClient.get<DataMigrationCycleBlockApi[]>(
    `${ENDPOINTS.dataMigrationCycleBlocks}?cycle_start_date=${encodeURIComponent(cycleStartDate)}&cycle_end_date=${encodeURIComponent(cycleEndDate)}&cycle_duration_days=${cycleDurationDays}`,
  )
  return items.map(b => ({
    startDate: b.start_date,
    endDate: b.end_date,
    bookedCount: b.booked_count,
    asrDrBookedCount: b.asr_dr_booked_count,
  }))
}

export interface SurveyDraftPayload {
  current_index: number
  answers: Record<string, unknown>
  attachment_answers: Record<string, string[]>
  removed_attachment_ids: string[]
  resource_answers: Record<string, Record<string, unknown>>
}

export interface SurveyDraftApi {
  id: string
  user_id: string
  project_id: string
  payload: SurveyDraftPayload
  updated_at: string
}

export async function getSurveyDraft(projectId: string): Promise<SurveyDraftApi | null> {
  if (USE_MOCK) { await delay(); return null }
  return apiClient.get<SurveyDraftApi | null>(ENDPOINTS.surveyDraft(projectId))
}

export async function saveSurveyDraft(
  projectId: string,
  payload: SurveyDraftPayload,
): Promise<SurveyDraftApi> {
  if (USE_MOCK) { await delay(); return { id: 'mock', user_id: 'mock', project_id: projectId, payload, updated_at: new Date().toISOString() } }
  return apiClient.put<SurveyDraftApi>(ENDPOINTS.surveyDraft(projectId), { payload })
}

export async function deleteSurveyDraft(projectId: string): Promise<void> {
  if (USE_MOCK) { await delay(); return }
  return apiClient.delete<void>(ENDPOINTS.surveyDraft(projectId))
}

export async function getSurveyDraftProjectIds(): Promise<string[]> {
  if (USE_MOCK) { await delay(); return [] }
  return apiClient.get<string[]>(`${ENDPOINTS.projects}/survey-drafts`)
}

export async function markResourceSyncComplete(
  projectId: string,
  resourceId: string,
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(projectId)
    if (!p) throw new Error('Project not found')
    const resources = (p.currentInfrastructure?.resources ?? []).map(r =>
      r.resourceId === resourceId
        ? { ...r, syncStatus: 'synced' as const, migrationCompleted: true }
        : r
    )
    store.updateProject(projectId, 'currentInfrastructure', {
      ...(p.currentInfrastructure ?? { resources: [] }),
      resources,
    })
    return store.getProject(projectId)!
  }
  const raw = await apiClient.post<ProjectApiResponse>(
    ENDPOINTS.resourceSyncComplete(projectId, resourceId),
    {},
  )
  return fromApi(raw)
}

export async function updateGovernanceRoles(
  projectId: string,
  payload: {
    technicalLeadId?: string
    businessOwnerId?: string
    dbaDataOwnerId?: string
    gbiChampionId?: string
    gbiChampionDelegateId?: string
  },
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(projectId)
    if (!p) throw new Error('Project not found')
    store.updateProject(projectId, 'governanceRoles', {
      technicalLead: payload.technicalLeadId
        ? { id: payload.technicalLeadId, name: '', email: '', department: '', initials: '' }
        : undefined,
      businessOwner: payload.businessOwnerId
        ? { id: payload.businessOwnerId, name: '', email: '', department: '', initials: '' }
        : undefined,
      dbaDataOwner: payload.dbaDataOwnerId
        ? { id: payload.dbaDataOwnerId, name: '', email: '', department: '', initials: '' }
        : undefined,
      gbiChampion: payload.gbiChampionId
        ? { id: payload.gbiChampionId, name: '', email: '', department: '', initials: '' }
        : undefined,
      gbiChampionDelegate: payload.gbiChampionDelegateId
        ? { id: payload.gbiChampionDelegateId, name: '', email: '', department: '', initials: '' }
        : undefined,
    } as Project['governanceRoles'])
    return store.getProject(projectId)!
  }
  const raw = await apiClient.put<ProjectApiResponse>(
    `/api/v1/projects/${projectId}/governance-roles`,
    payload,
  )
  return fromApi(raw)
}

export async function updateSurveyNeed(
  projectId: string,
  payload: { isSurveyNeeded: boolean; justificationWithoutSurvey?: string | null },
): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    const p = store.getProject(projectId)
    if (!p) throw new Error('Project not found')
    store.updateProject(projectId, 'isSurveyNeeded', payload.isSurveyNeeded)
    store.updateProject(
      projectId,
      'justificationWithoutSurvey',
      payload.justificationWithoutSurvey ? payload.justificationWithoutSurvey : undefined,
    )
    return store.getProject(projectId)!
  }
  const raw = await apiClient.put<ProjectApiResponse>(ENDPOINTS.surveyNeed(projectId), {
    is_survey_needed: payload.isSurveyNeeded,
    justification_without_survey: payload.justificationWithoutSurvey || null,
  })
  return fromApi(raw)
}

export async function resetProject(id: string): Promise<Project> {
  if (USE_MOCK) {
    await delay()
    return store.resetProject(id)
  }
  const raw = await apiClient.post<ProjectApiResponse>(`/api/v1/projects/${id}/reset`, {})
  return fromApi(raw)
}
