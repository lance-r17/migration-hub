import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { BillingThresholdConfig } from '@/types/finance'

const ENDPOINT = '/api/v1/settings/billing-thresholds'

export async function getBillingThresholdConfig(): Promise<BillingThresholdConfig> {
  if (USE_MOCK) { await delay(); return store.getBillingThresholdConfig() }
  return apiClient.get<BillingThresholdConfig>(ENDPOINT)
}

export async function saveBillingThresholdConfig(config: BillingThresholdConfig): Promise<BillingThresholdConfig> {
  if (USE_MOCK) { await delay(300); return store.setBillingThresholdConfig(config) }
  return apiClient.post<BillingThresholdConfig>(ENDPOINT, config)
}
