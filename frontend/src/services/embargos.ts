import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient, BASE_URL } from './client'
import type { EmbargoRecord } from '@/types/embargo'

const ENDPOINTS = {
  embargos: '/api/v1/embargos',
  embargo: (id: string) => `/api/v1/embargos/${id}`,
}

export async function getEmbargos(): Promise<EmbargoRecord[]> {
  if (USE_MOCK) { await delay(); return store.getEmbargos() }
  return apiClient.get<EmbargoRecord[]>(ENDPOINTS.embargos)
}

export async function createEmbargo(
  data: Omit<EmbargoRecord, 'id' | 'createdAt'>,
): Promise<EmbargoRecord> {
  if (USE_MOCK) {
    await delay(300)
    const embargo: EmbargoRecord = {
      ...data,
      id: `emb-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    }
    return store.addEmbargo(embargo)
  }
  return apiClient.post<EmbargoRecord>(ENDPOINTS.embargos, data)
}

export async function updateEmbargo(
  id: string,
  patch: Partial<Omit<EmbargoRecord, 'id' | 'createdAt'>>,
): Promise<EmbargoRecord> {
  if (USE_MOCK) { await delay(300); return store.updateEmbargo(id, patch) }
  return apiClient.put<EmbargoRecord>(ENDPOINTS.embargo(id), patch)
}

export async function deleteEmbargo(id: string): Promise<void> {
  if (USE_MOCK) { await delay(200); store.deleteEmbargo(id); return }
  const res = await fetch(`${BASE_URL}${ENDPOINTS.embargo(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`DELETE ${ENDPOINTS.embargo(id)} failed: ${res.status}`)
}
