import {
  mockProjects,
  mockUsers,
  mockProjectUsers,
  mockCurrentUser,
  overallStats,
  recentActivity,
  mockAuditEntries,
} from '@/data/mock'
import type { Project, User, OverallStats, Activity } from '@/types'
import type { AuditLogEntry } from '@/types/audit'

// Mutable in-memory session store — deep copy of mock data.
// Writes persist for the lifetime of the browser tab (resets on page refresh).
// All service functions read/write exclusively through this store.

let _projects: Project[] = structuredClone(mockProjects)
let _auditLogs: Record<string, AuditLogEntry[]> = structuredClone(mockAuditEntries)
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

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  getOverallStats(): OverallStats {
    return _stats
  },

  getRecentActivity(): Activity[] {
    return _activity
  },
}
