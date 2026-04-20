import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { BillingBreakdownRecord, BillingRecord, BillingUpload } from '@/types/finance'

const ENDPOINTS = {
  months: (env: string) => `/api/v1/billing/months?env=${env}`,
  records: (month: string, env: string) => `/api/v1/billing?month=${month}&env=${env}`,
  upload: '/api/v1/billing',
  uploadXlsx: '/api/v1/billing/upload',
  breakdown: (month: string, env: string, resourceSet: string) =>
    `/api/v1/billing/breakdown?month=${month}&env=${env}&resource_set=${encodeURIComponent(resourceSet)}`,
  deleteMonth: (month: string) => `/api/v1/billing/month?month=${encodeURIComponent(month)}`,
}

// ─── Raw API shapes ───────────────────────────────────────────────────────────

interface BillingRecordApi {
  month: string
  env: string
  resource_set: string
  amount: number
}

interface BillingBreakdownRecordApi {
  month: string
  env: string
  resource_set: string
  product: string
  amount: number
}

function fromApi(r: BillingRecordApi): BillingRecord {
  return { resourceSet: r.resource_set, amount: r.amount }
}

function fromBreakdownApi(r: BillingBreakdownRecordApi): BillingBreakdownRecord {
  return { resourceSet: r.resource_set, product: r.product, amount: r.amount }
}

function toApiRecords(records: BillingRecord[]): { resource_set: string; amount: number }[] {
  return records.map(r => ({ resource_set: r.resourceSet, amount: r.amount }))
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getAvailableBillingMonths(env: 'existing' | 'target'): Promise<string[]> {
  if (USE_MOCK) { await delay(); return store.getBillingMonths(env) }
  return apiClient.get<string[]>(ENDPOINTS.months(env))
}

export async function getBillingRecords(month: string, env: 'existing' | 'target'): Promise<BillingRecord[]> {
  if (USE_MOCK) { await delay(); return store.getBillingRecords(month, env) }
  const raw = await apiClient.get<BillingRecordApi[]>(ENDPOINTS.records(month, env))
  return raw.map(fromApi)
}

export async function uploadBillingRecords(upload: BillingUpload): Promise<void> {
  if (USE_MOCK) {
    await delay(400)
    store.setBillingRecords(upload.month, upload.env, upload.records)
    return
  }
  await apiClient.post<void>(ENDPOINTS.upload, {
    month: upload.month,
    env: upload.env,
    records: toApiRecords(upload.records),
  })
}

export async function uploadBillingXlsx(
  file: File,
  month: string,
  env: 'existing' | 'target',
): Promise<void> {
  if (USE_MOCK) {
    await delay(600)
    // In mock mode just record the month so the selector appears; no breakdown data
    store.setBillingRecords(month, env, store.getBillingRecords(month, env))
    return
  }
  const form = new FormData()
  form.append('month', month)
  form.append('env', env)
  form.append('file', file)
  await apiClient.postForm<void>(ENDPOINTS.uploadXlsx, form)
}

export async function deleteBillingMonth(month: string): Promise<void> {
  if (USE_MOCK) { await delay(); store.deleteBillingMonth(month); return }
  await apiClient.delete<void>(ENDPOINTS.deleteMonth(month))
}

export async function getBillingBreakdown(
  month: string,
  env: 'existing' | 'target',
  resourceSet: string,
): Promise<BillingBreakdownRecord[]> {
  if (USE_MOCK) {
    await delay()
    return store.getBillingBreakdown(month, env, resourceSet)
  }
  const raw = await apiClient.get<BillingBreakdownRecordApi[]>(
    ENDPOINTS.breakdown(month, env, resourceSet),
  )
  return raw.map(fromBreakdownApi)
}
