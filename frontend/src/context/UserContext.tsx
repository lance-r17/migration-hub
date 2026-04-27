import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '@/services/users'
import { oidcManager } from '@/auth/oidcManager'
import { setOnUnauthorized } from '@/services/client'
import type { User } from '@/types'

const AUTH_KEY = 'auth'

interface UserContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === 'true'
  )
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    // Check custom OAuth backend token expiry first
    const backendToken = sessionStorage.getItem('backend_token')
    if (backendToken) {
      try {
        const payload = JSON.parse(atob(backendToken.split('.')[1]))
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          logout()
          window.location.assign('/login')
          return
        }
      } catch {
        // malformed token — treat as expired
        logout()
        window.location.assign('/login')
        return
      }

      getCurrentUser()
        .then((u) => {
          setUser(u)
        })
        .catch(() => {
          logout()
          window.location.assign('/login')
        })
        .finally(() => setLoading(false))
      return
    }

    // Fall back to OIDC token check
    Promise.resolve(oidcManager?.getUser()).then((oidcUser) => {
      if (oidcUser?.expired) {
        logout()
        window.location.assign('/login')
        return
      }

      getCurrentUser()
        .then((u) => {
          setUser(u)
        })
        .catch(() => {
          logout()
          window.location.assign('/login')
        })
        .finally(() => setLoading(false))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback((loggedInUser: User) => {
    setUser(loggedInUser)
    setIsAuthenticated(true)
    sessionStorage.setItem(AUTH_KEY, 'true')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setIsAuthenticated(false)
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem('backend_token')
    sessionStorage.removeItem('oauth_state')
    sessionStorage.removeItem('oauth_redirect')
    // Clear OIDC session without redirecting (silent local logout)
    oidcManager?.removeUser()
  }, [])

  // Global 401 handler: any API call returning 401 logs the user out and
  // redirects to the login page.
  useEffect(() => {
    setOnUnauthorized(() => {
      logout()
      window.location.assign('/login')
    })
    return () => setOnUnauthorized(null)
  }, [logout])

  return (
    <UserContext.Provider
      value={{ user, loading, isAuthenticated, login, logout }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): UserContextValue {
  return useContext(UserContext)
}
