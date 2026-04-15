import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient, BASE_URL } from './client'
import type { EmbargoRecord } from '@/types/embargo'

const ENDPOINTS = {
  embargos: '/api/v1/embargos',
  embargo: (id: string) => `/api/v1/embargos/${id}`,
}

interface EmbargoApiRecord {
  id: string
  name: string
  start_date: string
  end_date: string
  affected_service_lines: string[]
  created_at: string | null
}

function fromApi(r: EmbargoApiRecord): EmbargoRecord {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    affectedServiceLines: r.affected_service_lines ?? [],
    createdAt: r.created_at ?? '',
  }
}

function toApi(data: Omit<EmbargoRecord, 'id' | 'createdAt'>) {
  return {
    name: data.name,
    start_date: data.startDate,
    end_date: data.endDate,
    affected_service_lines: data.affectedServiceLines,
  }
}

export async function getEmbargos(): Promise<EmbargoRecord[]> {
  if (USE_MOCK) { await delay(); return store.getEmbargos() }
  const records = await apiClient.get<EmbargoApiRecord[]>(ENDPOINTS.embargos)
  return records.map(fromApi)
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
  const record = await apiClient.post<EmbargoApiRecord>(ENDPOINTS.embargos, toApi(data))
  return fromApi(record)
}

export async function updateEmbargo(
  id: string,
  patch: Partial<Omit<EmbargoRecord, 'id' | 'createdAt'>>,
): Promise<EmbargoRecord> {
  if (USE_MOCK) { await delay(300); return store.updateEmbargo(id, patch) }
  const record = await apiClient.put<EmbargoApiRecord>(ENDPOINTS.embargo(id), toApi(patch as Omit<EmbargoRecord, 'id' | 'createdAt'>))
  return fromApi(record)
}

export async function deleteEmbargo(id: string): Promise<void> {
  if (USE_MOCK) { await delay(200); store.deleteEmbargo(id); return }
  const res = await fetch(`${BASE_URL}${ENDPOINTS.embargo(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`DELETE ${ENDPOINTS.embargo(id)} failed: ${res.status}`)
}
