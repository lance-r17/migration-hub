import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { CustomNavCardConfig } from '@/types/settings'

const ENDPOINT = '/api/v1/settings/nav-card'

export async function getCustomNavCardConfig(): Promise<CustomNavCardConfig> {
  if (USE_MOCK) {
    await delay()
    return store.getCustomNavCardConfig()
  }
  return apiClient.get<CustomNavCardConfig>(ENDPOINT)
}

export async function saveCustomNavCardConfig(
  config: CustomNavCardConfig
): Promise<CustomNavCardConfig> {
  if (USE_MOCK) {
    await delay(300)
    return store.setCustomNavCardConfig(config)
  }
  return apiClient.put<CustomNavCardConfig>(ENDPOINT, config)
}
