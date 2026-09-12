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

export interface LocalAccount {
  user_id: string
  account_name: string
  created_at: string
  updated_at: string
}

const localAccountEndpoint = (userId: string) => `${ENDPOINT}/${userId}/local-account`

/** Returns null when the user has no local account (404). */
export async function getLocalAccount(userId: string): Promise<LocalAccount | null> {
  try {
    return await apiClient.get<LocalAccount>(localAccountEndpoint(userId))
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('404')) return null
    throw err
  }
}

export async function createLocalAccount(
  userId: string,
  data: { account_name: string; password: string },
): Promise<LocalAccount> {
  return apiClient.post<LocalAccount>(localAccountEndpoint(userId), data)
}

export async function updateLocalAccountPassword(
  userId: string,
  password: string,
): Promise<LocalAccount> {
  return apiClient.put<LocalAccount>(localAccountEndpoint(userId), { password })
}

export async function deleteLocalAccount(userId: string): Promise<void> {
  return apiClient.delete<void>(localAccountEndpoint(userId))
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

const ENGAGEMENT_REVIEWERS_ENDPOINT = '/api/v1/admin/engagement-reviewers'

export interface EngagementReviewerCreate {
  id?: string
  name: string
  email: string
  department: string
  team?: string
}

export async function getEngagementReviewers(): Promise<User[]> {
  const raw = await apiClient.get<Record<string, unknown>[]>(ENGAGEMENT_REVIEWERS_ENDPOINT)
  return raw.map(userFromApi)
}

export async function createEngagementReviewer(data: EngagementReviewerCreate): Promise<User> {
  return userFromApi(await apiClient.post<Record<string, unknown>>(ENGAGEMENT_REVIEWERS_ENDPOINT, data))
}

export async function updateEngagementReviewer(id: string, data: UserAdminUpdate): Promise<User> {
  return userFromApi(await apiClient.patch<Record<string, unknown>>(`${ENGAGEMENT_REVIEWERS_ENDPOINT}/${id}`, data))
}

export async function deleteEngagementReviewer(id: string): Promise<void> {
  return apiClient.delete<void>(`${ENGAGEMENT_REVIEWERS_ENDPOINT}/${id}`)
}
