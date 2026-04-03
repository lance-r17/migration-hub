import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '@/services/users'
import type { User } from '@/types'

const AUTH_KEY = 'auth'

interface UserContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  isImpersonating: boolean
  login: (user: User) => void
  logout: () => void
  switchUser: (user: User) => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isImpersonating: false,
  login: () => {},
  logout: () => {},
  switchUser: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === 'true'
  )
  const [defaultUserId, setDefaultUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    getCurrentUser()
      .then((u) => {
        setUser(u)
        setDefaultUserId(u.id)
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback((loggedInUser: User) => {
    setUser(loggedInUser)
    setDefaultUserId(loggedInUser.id)
    setIsAuthenticated(true)
    sessionStorage.setItem(AUTH_KEY, 'true')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setDefaultUserId(null)
    setIsAuthenticated(false)
    sessionStorage.removeItem(AUTH_KEY)
  }, [])

  // Dev-only: switches the active user without touching sessionStorage.
  // Page refresh reverts to the real logged-in user.
  const switchUser = useCallback((nextUser: User) => {
    setUser(nextUser)
  }, [])

  const isImpersonating =
    user !== null && defaultUserId !== null && user.id !== defaultUserId

  return (
    <UserContext.Provider
      value={{ user, loading, isAuthenticated, isImpersonating, login, logout, switchUser }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): UserContextValue {
  return useContext(UserContext)
}
