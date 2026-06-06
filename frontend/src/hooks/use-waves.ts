import { useState, useEffect, useCallback } from 'react'
import { getWaves, createWave, importWave, deleteWave, updateWave } from '@/services/waves'
import type { Wave } from '@/types/wave'

interface WavesState {
  waves: Wave[]
  loading: boolean
  error: string | null
}

export function useWaves(options?: { enabled?: boolean }): WavesState & {
  createWave: (data: Omit<Wave, 'id' | 'createdAt' | 'jiraEpicKey'>) => Promise<Wave>
  importWave: (epicKey: string, color?: string) => Promise<Wave>
  deleteWave: (id: string) => Promise<void>
  restoreWave: (id: string) => Promise<Wave>
} {
  const enabled = options?.enabled !== false
  const [state, setState] = useState<WavesState>({
    waves: [],
    loading: enabled,
    error: null,
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getWaves()
      .then(waves => {
        if (!cancelled) setState({ waves, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          waves: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load waves',
        })
      })
    return () => { cancelled = true }
  }, [enabled])

  const handleCreate = useCallback(async (data: Omit<Wave, 'id' | 'createdAt' | 'jiraEpicKey'>) => {
    const wave = await createWave(data)
    setState(prev => ({ ...prev, waves: [...prev.waves, wave] }))
    return wave
  }, [])

  const handleImport = useCallback(async (epicKey: string, color?: string) => {
    const wave = await importWave(epicKey, color)
    setState(prev => ({ ...prev, waves: [...prev.waves, wave] }))
    return wave
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteWave(id)
    setState(prev => ({
      ...prev,
      waves: prev.waves.map(w => w.id === id ? { ...w, deleted: true } : w)
    }))
  }, [])

  const handleRestore = useCallback(async (id: string) => {
    const updated = await updateWave(id, { deleted: false })
    setState(prev => ({
      ...prev,
      waves: prev.waves.map(w => w.id === id ? updated : w)
    }))
    return updated
  }, [])

  return {
    ...state,
    createWave: handleCreate,
    importWave: handleImport,
    deleteWave: handleDelete,
    restoreWave: handleRestore,
  }
}
