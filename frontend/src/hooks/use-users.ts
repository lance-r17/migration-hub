import { useState, useEffect } from 'react'
import { getUsers, getProjectUsers } from '@/services/users'
import type { User } from '@/types'

interface UsersState {
  users: User[]
  loading: boolean
  error: string | null
}

export function useUsers(): UsersState {
  const [state, setState] = useState<UsersState>({
    users: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    getUsers()
      .then(users => {
        if (!cancelled) setState({ users, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          users: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load users',
        })
      })

    return () => { cancelled = true }
  }, [])

  return state
}

export function useProjectUsers(projectId: string): UsersState {
  const [state, setState] = useState<UsersState>({
    users: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!projectId) {
      setState({ users: [], loading: false, error: null })
      return
    }

    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: null }))

    getProjectUsers(projectId)
      .then(users => {
        if (!cancelled) setState({ users, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          users: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load project users',
        })
      })

    return () => { cancelled = true }
  }, [projectId])

  return state
}
