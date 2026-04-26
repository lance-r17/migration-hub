import { useState, useEffect, useCallback } from 'react'
import {
  getServiceAccounts,
  createServiceAccount as svcCreate,
  updateServiceAccount as svcUpdate,
  deleteServiceAccount as svcDelete,
  resetServiceAccountToken as svcResetToken,
} from '@/services/serviceAccounts'
import type { ServiceAccount, ServiceAccountCreate, ServiceAccountUpdate } from '@/types/serviceAccount'

interface ServiceAccountsState {
  serviceAccounts: ServiceAccount[]
  loading: boolean
  error: string | null
}

export function useServiceAccounts(): ServiceAccountsState & {
  createServiceAccount: (data: ServiceAccountCreate) => Promise<ServiceAccount & { api_key: string }>
  updateServiceAccount: (id: string, data: ServiceAccountUpdate) => Promise<ServiceAccount>
  deleteServiceAccount: (id: string) => Promise<void>
  resetServiceAccountToken: (id: string) => Promise<{ id: string; api_key: string }>
} {
  const [state, setState] = useState<ServiceAccountsState>({
    serviceAccounts: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    getServiceAccounts()
      .then((serviceAccounts) => {
        if (!cancelled) setState({ serviceAccounts, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            serviceAccounts: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load service accounts',
          })
      })
    return () => { cancelled = true }
  }, [])

  const handleCreate = useCallback(async (data: ServiceAccountCreate) => {
    const created = await svcCreate(data)
    setState((prev) => ({
      ...prev,
      serviceAccounts: [...prev.serviceAccounts, created],
    }))
    return created
  }, [])

  const handleUpdate = useCallback(async (id: string, data: ServiceAccountUpdate) => {
    const updated = await svcUpdate(id, data)
    setState((prev) => ({
      ...prev,
      serviceAccounts: prev.serviceAccounts.map((sa) => (sa.id === id ? updated : sa)),
    }))
    return updated
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await svcDelete(id)
    setState((prev) => ({
      ...prev,
      serviceAccounts: prev.serviceAccounts.filter((sa) => sa.id !== id),
    }))
  }, [])

  const handleResetToken = useCallback(async (id: string) => {
    const result = await svcResetToken(id)
    return result
  }, [])

  return {
    ...state,
    createServiceAccount: handleCreate,
    updateServiceAccount: handleUpdate,
    deleteServiceAccount: handleDelete,
    resetServiceAccountToken: handleResetToken,
  }
}
