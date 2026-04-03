import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { Project } from '@/types'

const ENDPOINTS = {
  projects: '/api/v1/projects',
  project: (id: string) => `/api/v1/projects/${id}`,
  section: (id: string, key: string) => `/api/v1/projects/${id}/sections/${key}`,
}

export async function getProjects(): Promise<Project[]> {
  // TODO (backend): return apiClient.get<Project[]>(ENDPOINTS.projects)
  if (USE_MOCK) { await delay(); return store.getProjects() }
  return apiClient.get<Project[]>(ENDPOINTS.projects)
}

export async function getProjectsForUser(userId: string): Promise<Project[]> {
  if (USE_MOCK) { await delay(); return store.getProjectsForUser(userId) }
  return apiClient.get<Project[]>(`${ENDPOINTS.projects}?userId=${userId}`)
}

export async function getProject(id: string): Promise<Project | undefined> {
  // TODO (backend): return apiClient.get<Project>(ENDPOINTS.project(id))
  if (USE_MOCK) { await delay(); return store.getProject(id) }
  return apiClient.get<Project>(ENDPOINTS.project(id))
}

export async function updateProject<K extends keyof Project>(
  id: string,
  key: K,
  value: Project[K],
): Promise<Project> {
  // TODO (backend): return apiClient.put<Project>(ENDPOINTS.section(id, String(key)), value)
  if (USE_MOCK) { await delay(); return store.updateProject(id, key, value) }
  return apiClient.put<Project>(ENDPOINTS.section(id, String(key)), value)
}
