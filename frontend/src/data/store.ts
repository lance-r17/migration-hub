import {
  mockProjects,
  mockUsers,
  mockProjectUsers,
  mockCurrentUser,
  overallStats,
  recentActivity,
  mockAuditEntries,
  mockWaves,
  mockProductCategoryMap,
} from '@/data/mock'
import type { Project, User, OverallStats, Activity, ProductCategoryEntry } from '@/types'
import type { AuditLogEntry } from '@/types/audit'
import type { Wave, JiraJobRequest } from '@/types/wave'
import type { SurveyConfig } from '@/types/survey'

// Mutable in-memory session store — deep copy of mock data.
// Writes persist for the lifetime of the browser tab (resets on page refresh).
// All service functions read/write exclusively through this store.

let _projects: Project[] = structuredClone(mockProjects)
let _waves: Wave[] = structuredClone(mockWaves)
let _jiraJobs: JiraJobRequest[] = []
let _auditLogs: Record<string, AuditLogEntry[]> = structuredClone(mockAuditEntries)
let _surveyConfig: SurveyConfig | null = null
const _users: User[] = structuredClone(mockUsers)
const _projectUserMap = structuredClone(mockProjectUsers)
const _currentUser: User = structuredClone(mockCurrentUser)
const _stats: OverallStats = structuredClone(overallStats)
const _activity: Activity[] = structuredClone(recentActivity)

export const store = {
  // ─── Projects ──────────────────────────────────────────────────────────────

  getProjects(): Project[] {
    return _projects
  },

  getProject(id: string): Project | undefined {
    return _projects.find(p => p.id === id)
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

  // ─── Product-Category Map ──────────────────────────────────────────────────

  getProductCategoryMap(): ProductCategoryEntry[] {
    return mockProductCategoryMap
  },

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  getOverallStats(): OverallStats {
    return _stats
  },

  getRecentActivity(): Activity[] {
    return _activity
  },
}
