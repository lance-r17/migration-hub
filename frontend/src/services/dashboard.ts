import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { OverallStats, Activity } from '@/types'

const ENDPOINTS = {
  stats: '/api/v1/dashboard/stats',
  activity: '/api/v1/dashboard/activity',
}

export async function getOverallStats(): Promise<OverallStats> {
  if (USE_MOCK) { await delay(); return store.getOverallStats() }
  const raw = await apiClient.get<Record<string, unknown>>(ENDPOINTS.stats)
  return {
    progress: raw.progress as number,
    totalAssets: raw.total_assets as number,
    targetCloud: raw.target_cloud as string,
    completed: raw.completed as number,
    inProgress: raw.in_progress as number,
  }
}

export async function getRecentActivity(): Promise<Activity[]> {
  if (USE_MOCK) { await delay(); return store.getRecentActivity() }
  const raw = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.activity)
  return raw.map((item) => ({
    id: item.id as string,
    type: item.type as Activity['type'],
    message: item.message as string,
    time: item.time as string,
    actor: item.actor as string,
    projectId: item.project_id as string | undefined,
    projectName: item.project_name as string | undefined,
  }))
}
