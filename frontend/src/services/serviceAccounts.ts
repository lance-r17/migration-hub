import { apiClient } from './client'
import type {
  ServiceAccount,
  ServiceAccountCreate,
  ServiceAccountUpdate,
  ServiceAccountTokenReset,
} from '@/types/serviceAccount'

const ENDPOINT = '/api/v1/admin/service-accounts'

export async function getServiceAccounts(): Promise<ServiceAccount[]> {
  return apiClient.get<ServiceAccount[]>(ENDPOINT)
}

export async function createServiceAccount(data: ServiceAccountCreate): Promise<ServiceAccount & { api_key: string }> {
  return apiClient.post<ServiceAccount & { api_key: string }>(ENDPOINT, data)
}

export async function updateServiceAccount(id: string, data: ServiceAccountUpdate): Promise<ServiceAccount> {
  return apiClient.patch<ServiceAccount>(`${ENDPOINT}/${id}`, data)
}

export async function deleteServiceAccount(id: string): Promise<void> {
  return apiClient.delete<void>(`${ENDPOINT}/${id}`)
}

export async function resetServiceAccountToken(id: string): Promise<ServiceAccountTokenReset> {
  return apiClient.post<ServiceAccountTokenReset>(`${ENDPOINT}/${id}/reset-token`, {})
}
