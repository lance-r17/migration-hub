import { useCallback, useEffect, useState } from 'react'
import { getProjectsTable } from '@/services/projects'
import type { ProjectTableRow } from '@/types'

const SEARCH_DEBOUNCE_MS = 300

interface UseProjectsTableParams {
  page: number
  pageSize: number
  status: string
  search: string
  migrationRange: string
  /** Filter: projects where this user holds this role */
  role?: string
  roleUserId?: string
  /** Selected BGI hierarchy nodes; null/undefined = no BGI filter */
  bgiIds?: string[] | null
  /** Excluded BGI hierarchy nodes (subtrees subtracted from the selection) */
  excludedBgiIds?: string[] | null
}

interface ProjectsTableState {
  rows: ProjectTableRow[]
  total: number
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useProjectsTable(params: UseProjectsTableParams): ProjectsTableState {
  const [rows, setRows] = useState<ProjectTableRow[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [resolvedKey, setResolvedKey] = useState<string | null>(null)

  const [debouncedSearch, setDebouncedSearch] = useState(params.search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(params.search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [params.search])

  // Serialized request identity — loading is derived from whether the latest
  // request has resolved, so no synchronous setState is needed in the effect.
  const requestKey = JSON.stringify([
    params.page,
    params.pageSize,
    params.status,
    debouncedSearch,
    params.migrationRange,
    params.role ?? null,
    params.roleUserId ?? null,
    params.bgiIds ?? null,
    params.excludedBgiIds ?? null,
    refreshKey,
  ])

  useEffect(() => {
    let cancelled = false
    const request = JSON.parse(requestKey) as [number, number, string, string, string, string | null, string | null, string[] | null, string[] | null, number]

    getProjectsTable({
      page: request[0],
      pageSize: request[1],
      status: request[2],
      search: request[3],
      migrationRange: request[4],
      role: request[5] ?? undefined,
      roleUserId: request[6] ?? undefined,
      bgiIds: request[7] ?? undefined,
      excludedBgiIds: request[8] ?? undefined,
    })
      .then(res => {
        if (!cancelled) {
          setRows(res.items)
          setTotal(res.total)
          setError(null)
          setResolvedKey(requestKey)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRows([])
          setTotal(0)
          setError(err instanceof Error ? err.message : 'Failed to load projects')
          setResolvedKey(requestKey)
        }
      })

    return () => { cancelled = true }
  }, [requestKey])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  return { rows, total, loading: resolvedKey !== requestKey, error, refresh }
}
