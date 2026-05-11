import { useState, useEffect, useCallback } from 'react'
import {
  getAdminUsers,
  updateAdminUser as svcUpdate,
  deleteAdminUser as svcDelete,
} from '@/services/adminUsers'
import type { User } from '@/types'
import type { UserAdminUpdate } from '@/services/adminUsers'

interface AdminUsersState {
  users: User[]
  loading: boolean
  error: string | null
}

export function useAdminUsers(): AdminUsersState & {
  updateUser: (id: string, data: UserAdminUpdate) => Promise<User>
  deleteUser: (id: string) => Promise<void>
  refresh: () => Promise<void>
} {
  const [state, setState] = useState<AdminUsersState>({
    users: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const users = await getAdminUsers()
      setState({ users, loading: false, error: null })
    } catch (err: unknown) {
      setState({
        users: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load users',
      })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getAdminUsers()
      .then((users) => {
        if (!cancelled) setState({ users, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            users: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load users',
          })
      })
    return () => { cancelled = true }
  }, [])

  const handleUpdate = useCallback(async (id: string, data: UserAdminUpdate) => {
    const updated = await svcUpdate(id, data)
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? updated : u)),
    }))
    return updated
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await svcDelete(id)
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== id),
    }))
  }, [])

  return {
    ...state,
    updateUser: handleUpdate,
    deleteUser: handleDelete,
    refresh: load,
  }
}
