import { useEffect, useRef, useCallback, useState } from 'react'
import { getSurveyDraft, saveSurveyDraft, deleteSurveyDraft } from '@/services/projects'
import type { SurveyDraftPayload } from '@/services/projects'

const DEBOUNCE_MS = 1500

function localStorageKey(userId: string, projectId: string): string {
  return `survey-draft:${userId}:${projectId}`
}

function readLocalDraft(userId: string, projectId: string): { payload: SurveyDraftPayload; updatedAt: string } | null {
  try {
    const raw = localStorage.getItem(localStorageKey(userId, projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.payload && parsed.updatedAt) {
      return { payload: parsed.payload as SurveyDraftPayload, updatedAt: parsed.updatedAt as string }
    }
    return null
  } catch {
    return null
  }
}

function writeLocalDraft(userId: string, projectId: string, payload: SurveyDraftPayload) {
  try {
    localStorage.setItem(localStorageKey(userId, projectId), JSON.stringify({ payload, updatedAt: new Date().toISOString() }))
  } catch {
    // ignore localStorage errors (e.g., quota exceeded)
  }
}

function removeLocalDraft(userId: string, projectId: string) {
  try {
    localStorage.removeItem(localStorageKey(userId, projectId))
  } catch {
    // ignore
  }
}

interface SurveyDraftState {
  payload: SurveyDraftPayload | null
  loading: boolean
}

export function useSurveyDraft(projectId: string | undefined, userId: string | undefined) {
  const [state, setState] = useState<SurveyDraftState>({ payload: null, loading: true })
  const pendingPayload = useRef<SurveyDraftPayload | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedPayload = useRef<string | null>(null)

  const reload = useCallback(async () => {
    if (!projectId || !userId) {
      setState({ payload: null, loading: false })
      return
    }

    setState({ payload: null, loading: true })

    try {
      const serverDraft = await getSurveyDraft(projectId!)
      const localDraft = readLocalDraft(userId!, projectId!)

      let chosen: SurveyDraftPayload | null = null

      if (serverDraft && localDraft) {
        const serverTime = new Date(serverDraft.updated_at).getTime()
        const localTime = new Date(localDraft.updatedAt).getTime()
        chosen = serverTime >= localTime ? serverDraft.payload : localDraft.payload
      } else if (serverDraft) {
        chosen = serverDraft.payload
      } else if (localDraft) {
        chosen = localDraft.payload
      }

      setState({ payload: chosen, loading: false })
      if (chosen) {
        lastSavedPayload.current = JSON.stringify(chosen)
      }
    } catch {
      // Fallback to localStorage on network error
      const localDraft = readLocalDraft(userId!, projectId!)
      setState({ payload: localDraft?.payload ?? null, loading: false })
    }
  }, [projectId, userId])

  // Load draft on mount
  useEffect(() => {
    reload()
  }, [reload])

  // Persist function
  const persist = useCallback(async (payload: SurveyDraftPayload) => {
    if (!projectId || !userId) return
    const serialized = JSON.stringify(payload)
    if (serialized === lastSavedPayload.current) return

    writeLocalDraft(userId, projectId, payload)
    lastSavedPayload.current = serialized

    try {
      await saveSurveyDraft(projectId, payload)
    } catch {
      // localStorage already has the fallback
    }
  }, [projectId, userId])

  // Debounced save
  const saveDraft = useCallback((payload: SurveyDraftPayload) => {
    pendingPayload.current = payload
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      if (pendingPayload.current) {
        persist(pendingPayload.current)
        pendingPayload.current = null
      }
    }, DEBOUNCE_MS)
  }, [persist])

  // Immediate save (for navigation / unload)
  const saveDraftImmediately = useCallback((payload: SurveyDraftPayload) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    pendingPayload.current = null
    persist(payload)
  }, [persist])

  // Page lifecycle: save on hide / beforeunload
  useEffect(() => {
    if (!projectId || !userId) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingPayload.current) {
        // Use keepalive fetch for reliable unload save
        const payload = pendingPayload.current
        const serialized = JSON.stringify(payload)
        if (serialized === lastSavedPayload.current) return
        writeLocalDraft(userId, projectId, payload)
        fetch(`/api/v1/projects/${projectId}/survey-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
          keepalive: true,
        }).catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [projectId, userId])

  // Clear draft
  const clearDraft = useCallback(async () => {
    if (!projectId || !userId) return
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    pendingPayload.current = null
    lastSavedPayload.current = null
    setState({ payload: null, loading: false })
    removeLocalDraft(userId, projectId)
    try {
      await deleteSurveyDraft(projectId)
    } catch {
      // ignore cleanup errors
    }
  }, [projectId, userId])

  return {
    draftPayload: state.payload,
    loading: state.loading,
    reload,
    saveDraft,
    saveDraftImmediately,
    clearDraft,
  }
}
