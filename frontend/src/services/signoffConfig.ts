import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { SignoffConfig } from '@/types/settings'

const ENDPOINT = '/api/v1/settings/signoff'

export async function getSignoffConfig(): Promise<SignoffConfig> {
  if (USE_MOCK) { await delay(); return store.getSignoffConfig() }
  return apiClient.get<SignoffConfig>(ENDPOINT)
}

export async function saveSignoffConfig(config: SignoffConfig): Promise<SignoffConfig> {
  if (USE_MOCK) { await delay(300); return store.setSignoffConfig(config) }
  return apiClient.put<SignoffConfig>(ENDPOINT, config)
}
