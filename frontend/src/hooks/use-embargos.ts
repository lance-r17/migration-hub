import { useState, useEffect, useCallback } from 'react'
import {
  getEmbargos,
  createEmbargo as svcCreate,
  updateEmbargo as svcUpdate,
  deleteEmbargo as svcDelete,
} from '@/services/embargos'
import type { EmbargoRecord } from '@/types/embargo'

interface EmbargosState {
  embargos: EmbargoRecord[]
  loading: boolean
  error: string | null
}

export function useEmbargos(): EmbargosState & {
  createEmbargo: (data: Omit<EmbargoRecord, 'id' | 'createdAt'>) => Promise<EmbargoRecord>
  updateEmbargo: (id: string, patch: Partial<Omit<EmbargoRecord, 'id' | 'createdAt'>>) => Promise<EmbargoRecord>
  deleteEmbargo: (id: string) => Promise<void>
} {
  const [state, setState] = useState<EmbargosState>({
    embargos: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    getEmbargos()
      .then(embargos => {
        if (!cancelled) setState({ embargos, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          embargos: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load embargo periods',
        })
      })
    return () => { cancelled = true }
  }, [])

  const handleCreate = useCallback(async (data: Omit<EmbargoRecord, 'id' | 'createdAt'>) => {
    const embargo = await svcCreate(data)
    setState(prev => ({ ...prev, embargos: [...prev.embargos, embargo] }))
    return embargo
  }, [])

  const handleUpdate = useCallback(async (
    id: string,
    patch: Partial<Omit<EmbargoRecord, 'id' | 'createdAt'>>,
  ) => {
    const updated = await svcUpdate(id, patch)
    setState(prev => ({
      ...prev,
      embargos: prev.embargos.map(e => e.id === id ? updated : e),
    }))
    return updated
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await svcDelete(id)
    setState(prev => ({
      ...prev,
      embargos: prev.embargos.filter(e => e.id !== id),
    }))
  }, [])

  return {
    ...state,
    createEmbargo: handleCreate,
    updateEmbargo: handleUpdate,
    deleteEmbargo: handleDelete,
  }
}
