import { useState, useEffect, useCallback } from 'react'
import { getAuditLog } from '@/services/auditLog'
import type { AuditLogEntry } from '@/types/audit'

interface AuditLogState {
  entries: AuditLogEntry[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useAuditLog(projectId: string | undefined): AuditLogState {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!projectId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    getAuditLog(projectId)
      .then(data => {
        if (!cancelled) {
          setEntries(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [projectId, tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])

  return { entries, loading, error, refresh }
}
