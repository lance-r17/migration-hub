import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type {
  Project,
  TeamMember,
  ApplicationOverview,
  AvailabilityResilience,
  DataPersistence,
  Dependencies,
  NonFunctionalRequirements,
  MigrationConstraints,
  TargetArchitecture,
  CloudResource,
  Risk,
  Approval,
} from '@/types'
import type { JiraSubtaskConfig } from '@/types/wave'

const ENDPOINTS = {
  projects: '/api/v1/projects',
  project: (id: string) => `/api/v1/projects/${id}`,
  section: (id: string, key: string) => `/api/v1/projects/${id}/sections/${key}`,
}

// ─── Raw API shapes (snake_case, matching backend schemas) ────────────────────

interface CloudResourceApi {
  id: string
  project_id: string
  resource_id: string | null
  name: string
  product: string | null
  resource_set: string | null
  specs: Record<string, unknown> | null
  sub_application: string | null
  target_resource_id: string | null
  sync_status: string
  need_migration: boolean
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
  progress: number
  team: TeamMember[]
  description: string | null
  migration_wave: string | null
  profile_owner: string | null
  jira_ticket: string | null
  jira_base_url: string | null
  last_updated: string | null
  wave_id: string | null
  jira_story_key: string | null
  jira_job_status: string | null
  migration_constraints: MigrationConstraints | null
  approvals: ApprovalApi[]
  cloud_resources: CloudResourceApi[]
}

interface ProjectApiResponse extends ProjectListItemApi {
  jira_subtask_config: JiraSubtaskConfig | null
  application_overview: ApplicationOverview | null
  availability: AvailabilityResilience | null
  data_persistence: DataPersistence | null
  dependencies: Dependencies | null
  nfrs: NonFunctionalRequirements | null
  migration_constraints: MigrationConstraints | null
  target_architecture: TargetArchitecture | null
  cloud_resources: CloudResourceApi[]
  risks: RiskApi[]
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapResource(r: CloudResourceApi): CloudResource {
  return {
    id: r.id,
    resourceId: r.resource_id ?? undefined,
    name: r.name,
    product: r.product ?? undefined,
    resourceSet: r.resource_set ?? undefined,
    specs: r.specs ?? undefined,
    subApplication: r.sub_application ?? undefined,
    targetResourceId: r.target_resource_id ?? undefined,
    syncStatus: r.sync_status as CloudResource['syncStatus'],
    needMigration: r.need_migration,
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
    progress: raw.progress,
    team: raw.team ?? [],
    description: raw.description ?? undefined,
    migrationWave: raw.migration_wave ?? undefined,
    profileOwner: raw.profile_owner ?? undefined,
    jiraTicket: raw.jira_ticket ?? undefined,
    jiraBaseUrl: raw.jira_base_url ?? undefined,
    lastUpdated: raw.last_updated ?? undefined,
    waveId: raw.wave_id ?? undefined,
    jiraStoryKey: raw.jira_story_key ?? undefined,
    jiraJobStatus: raw.jira_job_status as Project['jiraJobStatus'] ?? undefined,
    migrationConstraints: raw.migration_constraints ?? undefined,
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
