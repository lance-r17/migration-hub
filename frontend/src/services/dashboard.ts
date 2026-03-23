import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { OverallStats, Activity } from '@/types'

const ENDPOINTS = {
  stats: '/api/v1/dashboard/stats',
  activity: '/api/v1/dashboard/activity',
}

export async function getOverallStats(): Promise<OverallStats> {
  // TODO (backend): return apiClient.get<OverallStats>(ENDPOINTS.stats)
  if (USE_MOCK) { await delay(); return store.getOverallStats() }
  return apiClient.get<OverallStats>(ENDPOINTS.stats)
}

export async function getRecentActivity(): Promise<Activity[]> {
  // TODO (backend): return apiClient.get<Activity[]>(ENDPOINTS.activity)
  if (USE_MOCK) { await delay(); return store.getRecentActivity() }
  return apiClient.get<Activity[]>(ENDPOINTS.activity)
}
