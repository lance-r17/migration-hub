import { useState, useEffect } from 'react'
import { getDataMigrationCycleBlocks } from '@/services/projects'
import type { DataMigrationCycleBlock } from '@/services/projects'

interface UseDataMigrationCycleBlocksOptions {
  startDate?: string
  endDate?: string
  durationDays?: number
  enabled?: boolean
}

export function useDataMigrationCycleBlocks(options: UseDataMigrationCycleBlocksOptions) {
  const { startDate, endDate, durationDays, enabled = true } = options
  const [blocks, setBlocks] = useState<DataMigrationCycleBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Data fetching is the canonical use case for effects: subscribe to async API state.
    if (!enabled || !startDate || !endDate || !durationDays) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getDataMigrationCycleBlocks(startDate, endDate, durationDays)
      .then((data) => {
        if (cancelled) return
        setBlocks(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [enabled, startDate, endDate, durationDays])

  return { blocks, loading, error }
}
