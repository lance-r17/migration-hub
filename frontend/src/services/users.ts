import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { User } from '@/types'

const ENDPOINTS = {
  users: '/api/v1/users',
  me: '/api/v1/users/me',
  projectUsers: (projectId: string) => `/api/v1/projects/${projectId}/users`,
}

export function userFromApi(u: Record<string, unknown>): User {
  const roleRaw = u.role as string | null | undefined
  return {
    ...(u as Omit<User, 'role'>),
    role: roleRaw ? roleRaw.split(',').map(r => r.trim()).filter(Boolean) : [],
  }
}

export async function getUsers(): Promise<User[]> {
  // TODO (backend): return apiClient.get<User[]>(ENDPOINTS.users)
  if (USE_MOCK) { await delay(); return store.getUsers() }
  return (await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.users)).map(userFromApi)
}

export async function getCurrentUser(): Promise<User> {
  // TODO (backend): return apiClient.get<User>(ENDPOINTS.me)
  if (USE_MOCK) { await delay(); return store.getCurrentUser() }
  return userFromApi(await apiClient.get<Record<string, unknown>>(ENDPOINTS.me))
}

export async function getProjectUsers(projectId: string): Promise<User[]> {
  // TODO (backend): return apiClient.get<User[]>(ENDPOINTS.projectUsers(projectId))
  if (USE_MOCK) { await delay(); return store.getProjectUsers(projectId) }
  return (await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.projectUsers(projectId))).map(userFromApi)
}

export async function login(_email: string, _password: string): Promise<User> {
  // TODO (backend): return apiClient.post<User>('/api/v1/auth/login', { email: _email, password: _password })
  if (USE_MOCK) { await delay(); return store.getCurrentUser() }
  return userFromApi(await apiClient.post<Record<string, unknown>>('/api/v1/auth/login', { email: _email, password: _password }))
}
