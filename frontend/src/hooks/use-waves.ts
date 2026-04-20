import { useState, useEffect, useCallback } from 'react'
import { getWaves, createWave, importWave } from '@/services/waves'
import type { Wave } from '@/types/wave'

interface WavesState {
  waves: Wave[]
  loading: boolean
  error: string | null
}

export function useWaves(): WavesState & {
  createWave: (data: Omit<Wave, 'id' | 'createdAt' | 'jiraEpicKey'>) => Promise<Wave>
  importWave: (epicKey: string, color?: string) => Promise<Wave>
} {
  const [state, setState] = useState<WavesState>({
    waves: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
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
  }, [])

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

  return {
    ...state,
    createWave: handleCreate,
    importWave: handleImport,
  }
}
