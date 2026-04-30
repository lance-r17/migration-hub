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
  jira_ticket: string | null
  jira_base_url: string | null
  updated_at: string | null
  wave_id: string | null
  jira_story_key: string | null
  jira_job_status: string | null
  planning: ProjectPlanning | null
  migration_constraints: MigrationConstraints | null
  migration_effort_estimation: MigrationEffortEstimation | null
  approvals: ApprovalApi[]
  cloud_resources: CloudResourceApi[]
}

interface ProjectApiResponse extends ProjectListItemApi {
  blocked_reason: string | null
  jira_subtask_config: JiraSubtaskConfig | null
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
    jiraTicket: raw.jira_ticket ?? undefined,
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
    risks: [],
    approvals: (raw.approvals ?? []).map(mapApproval),
    currentInfrastructure: raw.cloud_resources?.length
      ? { resources: raw.cloud_resources.map(mapResource) }
      : undefined,
  }
}

function fromApi(raw: ProjectApiResponse): Project {
  return {
    ...fromApiListItem(raw),
    jiraSubtaskConfig: raw.jira_subtask_config ?? undefined,
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

export async function getProjects(): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjects() }
  const items = await apiClient.get<ProjectListItemApi[]>(ENDPOINTS.projects)
  return items.map(fromApiListItem)
}

export async function getProjectsForUser(userId: string): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjectsForUser(userId) }
  const items = await apiClient.get<ProjectListItemApi[]>(`${ENDPOINTS.projects}?userId=${userId}`)
  return items.map(fromApiListItem)
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
