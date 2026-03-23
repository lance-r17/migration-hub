import { useState, useEffect } from 'react'
import { getOverallStats, getRecentActivity } from '@/services/dashboard'
import type { OverallStats, Activity } from '@/types'

interface DashboardState {
  stats: OverallStats | undefined
  activity: Activity[]
  loading: boolean
  error: string | null
}

export function useDashboard(): DashboardState {
  const [state, setState] = useState<DashboardState>({
    stats: undefined,
    activity: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    Promise.all([getOverallStats(), getRecentActivity()])
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
  }, [])

  return state
}
