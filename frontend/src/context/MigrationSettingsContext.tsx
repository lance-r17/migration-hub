import { useCurrentUser } from '@/context/UserContext'
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getMigrationSettings } from '@/services/migrationSettings'
import type { MigrationSettings } from '@/types/settings'

interface MigrationSettingsContextValue {
  settings: MigrationSettings | null
  loading: boolean
  refresh: () => Promise<void>
}

const MigrationSettingsContext = createContext<MigrationSettingsContextValue | undefined>(
  undefined
)

export function MigrationSettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useCurrentUser()
  const [settings, setSettings] = useState<MigrationSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await getMigrationSettings()
      setSettings(cfg)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load migration settings', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      refresh()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, isAuthenticated, refresh])

  return (
    <MigrationSettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </MigrationSettingsContext.Provider>
  )
}

export function useMigrationSettingsContext() {
  const ctx = useContext(MigrationSettingsContext)
  if (!ctx) {
    throw new Error(
      'useMigrationSettingsContext must be used within MigrationSettingsProvider'
    )
  }
  return ctx
}
