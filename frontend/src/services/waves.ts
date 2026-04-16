import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { Wave } from '@/types/wave'

const ENDPOINTS = {
  waves: '/api/v1/waves',
  wave: (id: string) => `/api/v1/waves/${id}`,
  import: '/api/v1/waves/import',
}

interface WaveApiRecord {
  id: string
  name: string
  start_date: string
  cutover_date: string
  description?: string
  jira_project_key: string
  jira_epic_key?: string
  jira_base_url?: string
  source: string
  status: string
  created_at: string
}

function fromApi(r: WaveApiRecord): Wave {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    cutoverDate: r.cutover_date,
    description: r.description,
    jiraProjectKey: r.jira_project_key,
    jiraEpicKey: r.jira_epic_key,
    jiraBaseUrl: r.jira_base_url,
    source: r.source as Wave['source'],
    status: r.status as Wave['status'],
    createdAt: r.created_at,
  }
}

function toApi(data: Omit<Wave, 'id' | 'createdAt' | 'jiraEpicKey' | 'jiraProjectKey'>) {
  return {
    name: data.name,
    start_date: data.startDate,
    cutover_date: data.cutoverDate,
    description: data.description,
    source: data.source,
    status: data.status,
  }
}

export async function getWaves(): Promise<Wave[]> {
  if (USE_MOCK) { await delay(); return store.getWaves() }
  const records = await apiClient.get<WaveApiRecord[]>(ENDPOINTS.waves)
  return records.map(fromApi)
}

export async function getWave(id: string): Promise<Wave | undefined> {
  if (USE_MOCK) { await delay(); return store.getWave(id) }
  const record = await apiClient.get<WaveApiRecord>(ENDPOINTS.wave(id))
  return fromApi(record)
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
  const record = await apiClient.post<WaveApiRecord>(ENDPOINTS.waves, toApi(data))
  return fromApi(record)
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
  const record = await apiClient.post<WaveApiRecord>(ENDPOINTS.import, { epic_key: epicKey })
  return fromApi(record)
}
