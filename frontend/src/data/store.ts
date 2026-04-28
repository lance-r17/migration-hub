import {
  mockProjects,
  mockUsers,
  mockProjectUsers,
  mockCurrentUser,
  overallStats,
  mockAuditEntries,
  mockWaves,
  mockProductCategoryMap,
  mockSurveyConfig,
  mockResourceSurveyConfig,
  mockBillingExisting,
  mockBillingTarget,
  mockBillingBreakdown,
  mockEmbargos,
} from '@/data/mock'
import type { Project, User, OverallStats, Activity, ProductCategoryEntry } from '@/types'
import type { AuditLogEntry } from '@/types/audit'
import { buildActivityMessage } from '@/utils/activityMessages'
import type { Wave, JiraJobRequest } from '@/types/wave'
import type { SurveyConfig, ResourceSurveyConfig } from '@/types/survey'
import type { BillingBreakdownRecord, BillingRecord, BillingThresholdConfig } from '@/types/finance'
import type { EmbargoRecord } from '@/types/embargo'
import type { SignoffConfig } from '@/types/settings'

// Mutable in-memory session store — deep copy of mock data.
// Writes persist for the lifetime of the browser tab (resets on page refresh).
// All service functions read/write exclusively through this store.

let _projects: Project[] = structuredClone(mockProjects)
let _waves: Wave[] = structuredClone(mockWaves)
let _billingExisting: Record<string, BillingRecord[]> = structuredClone(mockBillingExisting)
let _billingTarget: Record<string, BillingRecord[]>   = structuredClone(mockBillingTarget)
let _billingBreakdown: Map<string, BillingBreakdownRecord[]> = new Map(
  Object.entries(mockBillingBreakdown).map(([k, v]) => [k, structuredClone(v)])
)
let _jiraJobs: JiraJobRequest[] = []
let _auditLogs: Record<string, AuditLogEntry[]> = structuredClone(mockAuditEntries)
let _surveyConfig: SurveyConfig | null = structuredClone(mockSurveyConfig)
let _resourceSurveyConfig: ResourceSurveyConfig = structuredClone(mockResourceSurveyConfig)
let _embargos: EmbargoRecord[] = structuredClone(mockEmbargos)
let _billingThresholdConfig: BillingThresholdConfig = { healthyAtRiskThreshold: 100, atRiskOverThreshold: 120, currency: 'CNY', baselineMonth: undefined, ytdStartMonth: undefined }
let _signoffConfig: SignoffConfig = { enabled: true }
const _users: User[] = structuredClone(mockUsers)
const _projectUserMap = structuredClone(mockProjectUsers)
const _currentUser: User = structuredClone(mockCurrentUser)
const _stats: OverallStats = structuredClone(overallStats)

export const store = {
  // ─── Projects ──────────────────────────────────────────────────────────────

  getProjects(): Project[] {
    return _projects.map(p => ({ ...p, approvals: p.approvals ?? [], risks: p.risks ?? [] }))
  },

  getProject(id: string): Project | undefined {
    const p = _projects.find(p => p.id === id)
    return p ? { ...p, approvals: p.approvals ?? [], risks: p.risks ?? [] } : undefined
  },

  updateProject<K extends keyof Project>(id: string, key: K, value: Project[K]): Project {
    const idx = _projects.findIndex(p => p.id === id)
    if (idx === -1) throw new Error(`Project not found: ${id}`)
    _projects[idx] = { ..._projects[idx], [key]: value }
    return _projects[idx]
  },

  // ─── Waves ─────────────────────────────────────────────────────────────────

  getWaves(): Wave[] {
    return _waves
  },

  getWave(id: string): Wave | undefined {
    return _waves.find(w => w.id === id)
  },

  addWave(wave: Wave): Wave {
    _waves.push(wave)
    return wave
  },

  updateWave(id: string, patch: Partial<Wave>): Wave {
    const idx = _waves.findIndex(w => w.id === id)
    if (idx === -1) throw new Error(`Wave not found: ${id}`)
    _waves[idx] = { ..._waves[idx], ...patch }
    return _waves[idx]
  },

  // ─── Jira Jobs ─────────────────────────────────────────────────────────────

  getJiraJob(id: string): JiraJobRequest | undefined {
    return _jiraJobs.find(j => j.id === id)
  },

  addJiraJob(job: JiraJobRequest): JiraJobRequest {
    _jiraJobs.push(job)
    return job
  },

  updateJiraJob(id: string, patch: Partial<JiraJobRequest>): JiraJobRequest {
    const idx = _jiraJobs.findIndex(j => j.id === id)
    if (idx === -1) throw new Error(`JiraJob not found: ${id}`)
    _jiraJobs[idx] = { ..._jiraJobs[idx], ...patch }
    return _jiraJobs[idx]
  },

  // ─── Users ─────────────────────────────────────────────────────────────────

  getUsers(): User[] {
    return _users
  },

  getCurrentUser(): User {
    return _currentUser
  },

  getProjectUsers(projectId: string): User[] {
    const entry = _projectUserMap.find(pu => pu.projectId === projectId)
    if (!entry) return _users
    return entry.userIds
      .map(uid => _users.find(u => u.id === uid))
      .filter((u): u is User => u !== undefined)
  },

  getProjectsForUser(userId: string): Project[] {
    const assignedIds = _projectUserMap
      .filter(pu => pu.userIds.includes(userId))
      .map(pu => pu.projectId)
    return _projects.filter(p => assignedIds.includes(p.id))
  },

  // ─── Audit Log ─────────────────────────────────────────────────────────────

  getAuditLog(projectId: string): AuditLogEntry[] {
    return (_auditLogs[projectId] ?? []).slice().sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  },

  appendAuditEntry(entry: AuditLogEntry): void {
    if (!_auditLogs[entry.projectId]) _auditLogs[entry.projectId] = []
    _auditLogs[entry.projectId].push(entry)
  },

  // ─── Survey Config ─────────────────────────────────────────────────────────

  getSurveyConfig(): SurveyConfig | null {
    return _surveyConfig
  },

  setSurveyConfig(config: SurveyConfig): SurveyConfig {
    _surveyConfig = config
    return _surveyConfig
  },

  // ─── Resource Survey Config ────────────────────────────────────────────────

  getResourceSurveyConfig(): ResourceSurveyConfig {
    return _resourceSurveyConfig
  },

  setResourceSurveyConfig(config: ResourceSurveyConfig): ResourceSurveyConfig {
    _resourceSurveyConfig = config
    return _resourceSurveyConfig
  },

  batchUpdateResourceSpecs(
    projectId: string,
    updates: { resourceId: string; specs: Record<string, unknown> }[]
  ): Project {
    const project = this.getProject(projectId)
    if (!project) throw new Error(`Project not found: ${projectId}`)
    const resources = [...(project.currentInfrastructure?.resources ?? [])]
    for (const { resourceId, specs } of updates) {
      const idx = resources.findIndex(r => r.resourceId === resourceId)
      if (idx !== -1) {
        resources[idx] = {
          ...resources[idx]!,
          specs: { ...(resources[idx]!.specs ?? {}), ...specs },
        }
      }
    }
    const updatedInfra = { ...(project.currentInfrastructure ?? {}), resources }
    return this.updateProject(projectId, 'currentInfrastructure', updatedInfra as Project['currentInfrastructure'])
  },

  // ─── Embargos ──────────────────────────────────────────────────────────────

  getEmbargos(): EmbargoRecord[] {
    return _embargos
  },

  getEmbargo(id: string): EmbargoRecord | undefined {
    return _embargos.find(e => e.id === id)
  },

  addEmbargo(embargo: EmbargoRecord): EmbargoRecord {
    _embargos.push(embargo)
    return embargo
  },

  updateEmbargo(id: string, patch: Partial<EmbargoRecord>): EmbargoRecord {
    const idx = _embargos.findIndex(e => e.id === id)
    if (idx === -1) throw new Error(`Embargo not found: ${id}`)
    _embargos[idx] = { ..._embargos[idx], ...patch }
    return _embargos[idx]
  },

  deleteEmbargo(id: string): void {
    const idx = _embargos.findIndex(e => e.id === id)
    if (idx === -1) throw new Error(`Embargo not found: ${id}`)
    _embargos.splice(idx, 1)
  },

  // ─── Billing ───────────────────────────────────────────────────────────────

  getBillingMonths(env: 'existing' | 'target'): string[] {
    const src = env === 'existing' ? _billingExisting : _billingTarget
    return Object.keys(src).sort().reverse()
  },

  getBillingRecords(month: string, env: 'existing' | 'target'): BillingRecord[] {
    return (env === 'existing' ? _billingExisting : _billingTarget)[month] ?? []
  },

  setBillingRecords(month: string, env: 'existing' | 'target', records: BillingRecord[]): void {
    if (env === 'existing') _billingExisting[month] = records
    else _billingTarget[month] = records
  },

  getBillingBreakdown(month: string, env: 'existing' | 'target', resourceSet: string): BillingBreakdownRecord[] {
    return _billingBreakdown.get(`${month}|${env}|${resourceSet}`) ?? []
  },

  setBillingBreakdown(month: string, env: 'existing' | 'target', resourceSet: string, records: BillingBreakdownRecord[]): void {
    _billingBreakdown.set(`${month}|${env}|${resourceSet}`, records)
  },

  deleteBillingMonth(month: string): void {
    delete _billingExisting[month]
    delete _billingTarget[month]
    for (const key of _billingBreakdown.keys()) {
      if (key.startsWith(`${month}|`)) _billingBreakdown.delete(key)
    }
  },

  getBillingThresholdConfig(): BillingThresholdConfig {
    return _billingThresholdConfig
  },

  setBillingThresholdConfig(config: BillingThresholdConfig): BillingThresholdConfig {
    _billingThresholdConfig = { ...config }
    return _billingThresholdConfig
  },

  getSignoffConfig(): SignoffConfig {
    return _signoffConfig
  },

  setSignoffConfig(config: SignoffConfig): SignoffConfig {
    _signoffConfig = { ...config }
    return _signoffConfig
  },

  // ─── Product-Category Map ──────────────────────────────────────────────────

  getProductCategoryMap(): ProductCategoryEntry[] {
    return mockProductCategoryMap
  },

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  getOverallStats(): OverallStats {
    return _stats
  },

  getRecentActivity(): Activity[] {
    const projectMap = new Map(_projects.map(p => [p.id, p.name]))
    const allEntries = Object.values(_auditLogs).flat()
    const sorted = allEntries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    return sorted.map(entry => {
      const { message, type } = buildActivityMessage(entry, projectMap.get(entry.projectId))
      return {
        id: entry.id,
        type,
        message,
        time: entry.timestamp,
        actor: entry.actor.name,
        projectId: entry.projectId,
        projectName: projectMap.get(entry.projectId),
      }
    })
  },
}
