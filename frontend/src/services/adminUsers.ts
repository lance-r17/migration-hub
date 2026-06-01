import { apiClient } from './client'
import { userFromApi } from './users'
import type { User } from '@/types'

const ENDPOINT = '/api/v1/admin/users'
const PROJECT_ROLES_ENDPOINT = '/api/v1/admin/user-project-roles'

export interface UserAdminUpdate {
  name?: string
  email?: string
  department?: string
  team?: string
  role?: string
  gbi_id?: string | null
}

export interface UserProjectRole {
  user_id: string
  project_id: string
  project_name: string
  roles: string[]
}

export async function getAdminUsers(): Promise<User[]> {
  const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINT)
  return raw.map(userFromApi)
}

export async function updateAdminUser(id: string, data: UserAdminUpdate): Promise<User> {
  return userFromApi(await apiClient.patch<Record<string, unknown>>(`${ENDPOINT}/${id}`, data))
}

export async function deleteAdminUser(id: string): Promise<void> {
  return apiClient.delete<void>(`${ENDPOINT}/${id}`)
}

export async function getAllUserProjectRoles(): Promise<UserProjectRole[]> {
  return apiClient.get<UserProjectRole[]>(PROJECT_ROLES_ENDPOINT)
}

const GBI_CLOUD_LEADS_ENDPOINT = '/api/v1/admin/gbi-cloud-leads'

export interface GbiCloudLeadCreate {
  id?: string
  name: string
  email: string
  department: string
  team?: string
  gbi_id?: string | null
}

export async function getGbiCloudLeads(): Promise<User[]> {
  const raw = await apiClient.get<Record<string, unknown>[]>(GBI_CLOUD_LEADS_ENDPOINT)
  return raw.map(userFromApi)
}

export async function createGbiCloudLead(data: GbiCloudLeadCreate): Promise<User> {
  return userFromApi(await apiClient.post<Record<string, unknown>>(GBI_CLOUD_LEADS_ENDPOINT, data))
}

export async function updateGbiCloudLead(id: string, data: UserAdminUpdate): Promise<User> {
  return userFromApi(await apiClient.patch<Record<string, unknown>>(`${GBI_CLOUD_LEADS_ENDPOINT}/${id}`, data))
}

export async function deleteGbiCloudLead(id: string): Promise<void> {
  return apiClient.delete<void>(`${GBI_CLOUD_LEADS_ENDPOINT}/${id}`)
}
