import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { Wave } from '@/types/wave'

const ENDPOINTS = {
  waves: '/api/v1/waves',
  wave: (id: string) => `/api/v1/waves/${id}`,
  import: '/api/v1/waves/import',
}

export async function getWaves(): Promise<Wave[]> {
  if (USE_MOCK) { await delay(); return store.getWaves() }
  return apiClient.get<Wave[]>(ENDPOINTS.waves)
}

export async function getWave(id: string): Promise<Wave | undefined> {
  if (USE_MOCK) { await delay(); return store.getWave(id) }
  return apiClient.get<Wave>(ENDPOINTS.wave(id))
}

export async function createWave(
  data: Omit<Wave, 'id' | 'createdAt' | 'jiraEpicKey' | 'jiraProjectKey'>,
): Promise<Wave> {
  if (USE_MOCK) {
    // Simulate Jira epic creation — project key is backend-configured
    await delay(600)
    const jiraProjectKey = 'MIG'
    const ticketNum = Math.floor(Math.random() * 900) + 100
    const wave: Wave = {
      ...data,
      id: `wave-${crypto.randomUUID().slice(0, 8)}`,
      jiraProjectKey,
      jiraEpicKey: `${jiraProjectKey}-${ticketNum}`,
      createdAt: new Date().toISOString(),
    }
    return store.addWave(wave)
  }
  return apiClient.post<Wave>(ENDPOINTS.waves, data)
}

export async function importWave(epicKey: string): Promise<Wave> {
  if (USE_MOCK) {
    // Simulate fetching epic details from Jira
    await delay(800)
    const jiraProjectKey = epicKey.split('-')[0] ?? 'MIG'
    const today = new Date()
    const cutover = new Date(today)
    cutover.setDate(cutover.getDate() + 90)
    const wave: Wave = {
      id: `wave-${crypto.randomUUID().slice(0, 8)}`,
      name: `Wave (${epicKey})`,
      startDate: today.toISOString().slice(0, 10),
      cutoverDate: cutover.toISOString().slice(0, 10),
      jiraProjectKey,
      jiraEpicKey: epicKey,
      source: 'imported',
      status: 'planned',
      createdAt: new Date().toISOString(),
    }
    return store.addWave(wave)
  }
  return apiClient.post<Wave>(ENDPOINTS.import, { epicKey })
}
