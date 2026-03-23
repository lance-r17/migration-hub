import { useState, useEffect, useCallback } from 'react'
import { getProjects, getProject, updateProject } from '@/services/projects'
import type { Project } from '@/types'

interface ProjectsState {
  projects: Project[]
  loading: boolean
  error: string | null
}

export function useProjects(): ProjectsState {
  const [state, setState] = useState<ProjectsState>({
    projects: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    getProjects()
      .then(projects => {
        if (!cancelled) setState({ projects, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          projects: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load projects',
        })
      })

    return () => { cancelled = true }
  }, [])

  return state
}

interface ProjectState {
  project: Project | undefined
  loading: boolean
  error: string | null
  saveSection: <K extends keyof Project>(key: K, value: Project[K]) => Promise<void>
}

export function useProject(id: string | undefined): ProjectState {
  const [project, setProject] = useState<Project | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getProject(id)
      .then(data => {
        if (!cancelled) {
          setProject(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load project')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [id])

  const saveSection = useCallback(async <K extends keyof Project>(
    key: K,
    value: Project[K],
  ): Promise<void> => {
    if (!id || !project) return

    // Optimistic update
    const previous = project
    setProject(prev => prev ? { ...prev, [key]: value } : prev)

    try {
      const updated = await updateProject(id, key, value)
      setProject(updated)
    } catch (err) {
      // Roll back on failure
      setProject(previous)
      throw err
    }
  }, [id, project])

  return { project, loading, error, saveSection }
}
