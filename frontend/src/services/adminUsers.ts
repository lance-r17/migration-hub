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
  bgi_ids?: string[]
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

const BGI_CLOUD_LEADS_ENDPOINT = '/api/v1/admin/bgi-cloud-leads'

export interface BgiCloudLeadCreate {
  id?: string
  name: string
  email: string
  department: string
  team?: string
  bgi_ids?: string[]
}

export async function getBgiCloudLeads(): Promise<User[]> {
  const raw = await apiClient.get<Record<string, unknown>[]>(BGI_CLOUD_LEADS_ENDPOINT)
  return raw.map(userFromApi)
}

export async function createBgiCloudLead(data: BgiCloudLeadCreate): Promise<User> {
  return userFromApi(await apiClient.post<Record<string, unknown>>(BGI_CLOUD_LEADS_ENDPOINT, data))
}

export async function updateBgiCloudLead(id: string, data: UserAdminUpdate): Promise<User> {
  return userFromApi(await apiClient.patch<Record<string, unknown>>(`${BGI_CLOUD_LEADS_ENDPOINT}/${id}`, data))
}

export async function deleteBgiCloudLead(id: string): Promise<void> {
  return apiClient.delete<void>(`${BGI_CLOUD_LEADS_ENDPOINT}/${id}`)
}
