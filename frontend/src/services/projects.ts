import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type {
  Project,
  StageProgress,
  ProjectPlanning,
  TeamMember,
  ApplicationOverview,
  AvailabilityResilience,
  DataPersistence,
  Dependencies,
  NonFunctionalRequirements,
  MigrationConstraints,
  TargetArchitecture,
  MigrationEffortEstimation,
  CloudResource,
  Risk,
  Approval,
} from '@/types'
import type { JiraSubtaskConfig } from '@/types/wave'

const ENDPOINTS = {
  projects: '/api/v1/projects',
  project: (id: string) => `/api/v1/projects/${id}`,
  section: (id: string, key: string) => `/api/v1/projects/${id}/sections/${key}`,
  planning: (id: string) => `/api/v1/projects/${id}/planning`,
  surveySubmitted: (id: string) => `/api/v1/projects/${id}/survey-submitted`,
  surveyDraft: (id: string) => `/api/v1/projects/${id}/survey-draft`,
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
  itso_delegate: string | null
  jira_base_url: string | null
  updated_at: string | null
  wave_id: string | null
  jira_story_key: string | null
  jira_job_status: string | null
  planning: ProjectPlanning | null
  migration_constraints: MigrationConstraints | null
  migration_effort_estimation: MigrationEffortEstimation | null
  application_overview: ApplicationOverview | null
  approvals: ApprovalApi[]
  cloud_resources: CloudResourceApi[]
  risks: RiskApi[]
}

interface GovernanceRolesApi {
  technical_lead: { id: string; name: string; email: string; department: string; initials: string } | null
  business_owner: { id: string; name: string; email: string; department: string; initials: string } | null
  dba_data_owner: { id: string; name: string; email: string; department: string; initials: string } | null
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
    itsoDelegate: raw.itso_delegate ?? undefined,
    jiraBaseUrl: raw.jira_base_url ?? undefined,
    updatedAt: raw.updated_at ?? undefined,
    waveId: raw.wave_id ?? undefined,
    jiraStoryKey: raw.jira_story_key ?? undefined,
    jiraJobStatus: raw.jira_job_status as Project['jiraJobStatus'] ?? undefined,
    planning: raw.planning ?? undefined,
    surveySubmittedAt: raw.survey_submitted_at ?? undefined,
    stageProgress: raw.stage_progress ?? undefined,
    migrationConstraints: raw.migration_constraints ?? undefined,
    migrationEffortEstimation: raw.migration_effort_estimation ?? undefined,
    applicationOverview: raw.application_overview ?? undefined,
    risks: (raw.risks ?? []).map(mapRisk),
    approvals: (raw.approvals ?? []).map(mapApproval),
    currentInfrastructure: raw.cloud_resources?.length
      ? { resources: raw.cloud_resources.map(mapResource) }
      : undefined,
  }
}

function mapGovernanceRoles(raw: GovernanceRolesApi | null): Project['governanceRoles'] {
  if (!raw) return undefined
  return {
    technicalLead: raw.technical_lead ?? undefined,
    businessOwner: raw.business_owner ?? undefined,
    dbaDataOwner: raw.dba_data_owner ?? undefined,
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
  payload: { technicalLeadId?: string; businessOwnerId?: string; dbaDataOwnerId?: string },
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
    } as Project['governanceRoles'])
    return store.getProject(projectId)!
  }
  const raw = await apiClient.put<ProjectApiResponse>(
    `/api/v1/projects/${projectId}/governance-roles`,
    payload,
  )
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
