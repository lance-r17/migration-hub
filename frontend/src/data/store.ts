import {
  mockProjects,
  mockUsers,
  mockProjectUsers,
  mockCurrentUser,
  overallStats,
  recentActivity,
} from '@/data/mock'
import type { Project, User, OverallStats, Activity } from '@/types'

// Mutable in-memory session store — deep copy of mock data.
// Writes persist for the lifetime of the browser tab (resets on page refresh).
// All service functions read/write exclusively through this store.

let _projects: Project[] = structuredClone(mockProjects)
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

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  getOverallStats(): OverallStats {
    return _stats
  },

  getRecentActivity(): Activity[] {
    return _activity
  },
}
