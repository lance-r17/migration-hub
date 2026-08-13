import { useCurrentUser } from '@/context/UserContext'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { getCustomNavCardConfig } from '@/services/customNavCard'
import type { CustomNavCardConfig } from '@/types/settings'

interface CustomNavCardContextValue {
  config: CustomNavCardConfig | null
  loading: boolean
  refresh: () => Promise<void>
}

const CustomNavCardContext = createContext<CustomNavCardContextValue | undefined>(
  undefined
)

export function CustomNavCardProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useCurrentUser()
  const [config, setConfig] = useState<CustomNavCardConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await getCustomNavCardConfig()
      setConfig(cfg)
    } catch (err) {
      console.error('Failed to load custom nav card config', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refresh()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, isAuthenticated, refresh])

  return (
    <CustomNavCardContext.Provider value={{ config, loading, refresh }}>
      {children}
    </CustomNavCardContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomNavCardContext() {
  const ctx = useContext(CustomNavCardContext)
  if (!ctx) {
    throw new Error(
      'useCustomNavCardContext must be used within CustomNavCardProvider'
    )
  }
  return ctx
}
