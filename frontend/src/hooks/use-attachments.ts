import { useState, useEffect, useCallback } from 'react'
import { getAllAttachments, bulkDeleteAttachments as svcBulkDelete } from '@/services/attachments'
import type { AdminAttachment } from '@/types/attachment'

interface AttachmentsState {
  attachments: AdminAttachment[]
  loading: boolean
  error: string | null
  selectedIds: string[]
}

export function useAttachments(): AttachmentsState & {
  toggleSelection: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  bulkDelete: (ids: string[]) => Promise<void>
  refresh: () => void
} {
  const [state, setState] = useState<AttachmentsState>({
    attachments: [],
    loading: true,
    error: null,
    selectedIds: [],
  })

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const attachments = await getAllAttachments()
      setState((prev) => ({ ...prev, attachments, loading: false, error: null }))
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        attachments: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load attachments',
      }))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getAllAttachments()
      .then((attachments) => {
        if (!cancelled) setState((prev) => ({ ...prev, attachments, loading: false, error: null }))
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState((prev) => ({
            ...prev,
            attachments: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load attachments',
          }))
      })
    return () => { cancelled = true }
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((sid) => sid !== id)
        : [...prev.selectedIds, id],
    }))
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setState((prev) => ({
      ...prev,
      selectedIds: ids,
    }))
  }, [])

  const clearSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedIds: [] }))
  }, [])

  const bulkDelete = useCallback(async (ids: string[]) => {
    await svcBulkDelete(ids)
    setState((prev) => ({
      ...prev,
      selectedIds: [],
    }))
    await fetchData()
  }, [fetchData])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    ...state,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDelete,
    refresh,
  }
}
