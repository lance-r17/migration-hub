import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { BillingRecord, BillingUpload } from '@/types/finance'

const ENDPOINTS = {
  months: (env: string) => `/api/v1/billing/months?env=${env}`,
  records: (month: string, env: string) => `/api/v1/billing?month=${month}&env=${env}`,
  upload: '/api/v1/billing',
}

export async function getAvailableBillingMonths(env: 'existing' | 'target'): Promise<string[]> {
  if (USE_MOCK) { await delay(); return store.getBillingMonths(env) }
  return apiClient.get<string[]>(ENDPOINTS.months(env))
}

export async function getBillingRecords(month: string, env: 'existing' | 'target'): Promise<BillingRecord[]> {
  if (USE_MOCK) { await delay(); return store.getBillingRecords(month, env) }
  return apiClient.get<BillingRecord[]>(ENDPOINTS.records(month, env))
}

export async function uploadBillingRecords(upload: BillingUpload): Promise<void> {
  if (USE_MOCK) {
    await delay(400)
    store.setBillingRecords(upload.month, upload.env, upload.records)
    return
  }
  await apiClient.post<void>(ENDPOINTS.upload, upload)
}
