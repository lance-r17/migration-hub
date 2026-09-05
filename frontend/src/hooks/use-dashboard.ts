import { useState, useEffect } from 'react'
import { getOverallStats, getRecentActivity } from '@/services/dashboard'
import type { OverallStats, Activity } from '@/types'

interface DashboardState {
  stats: OverallStats | undefined
  activity: Activity[]
  loading: boolean
  error: string | null
}

export function useDashboard(options?: { enabled?: boolean; withStats?: boolean }): DashboardState {
  const enabled = options?.enabled !== false
  // withStats=false skips the /dashboard/stats call, which recomputes per-project
  // progress for all projects server-side — callers that already have the project
  // list (e.g. HomePage) can derive the overall average client-side instead.
  const withStats = options?.withStats !== false
  const [state, setState] = useState<DashboardState>({
    stats: undefined,
    activity: [],
    loading: enabled,
    error: null,
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    Promise.all([withStats ? getOverallStats() : Promise.resolve(undefined), getRecentActivity()])
      .then(([stats, activity]) => {
        if (!cancelled) setState({ stats, activity, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load dashboard data',
        }))
      })

    return () => { cancelled = true }
  }, [enabled, withStats])

  return state
}
