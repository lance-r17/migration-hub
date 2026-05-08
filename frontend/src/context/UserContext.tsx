import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '@/services/users'
import { oidcManager } from '@/auth/oidcManager'
import { setOnUnauthorized } from '@/services/client'
import type { User } from '@/types'

const AUTH_KEY = 'auth'
const REDIRECT_KEY = 'post_login_redirect'

function saveRedirect() {
  const path = window.location.pathname + window.location.search
  if (path !== '/login' && path !== '/callback') {
    localStorage.setItem(REDIRECT_KEY, path)
  }
}

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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const local = localStorage.getItem(AUTH_KEY)
    if (local) return local === 'true'
    const session = sessionStorage.getItem(AUTH_KEY)
    if (session) {
      localStorage.setItem(AUTH_KEY, session)
      return session === 'true'
    }
    return false
  })

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    // Check custom OAuth backend token expiry first
    let backendToken = localStorage.getItem('backend_token')
    if (!backendToken) {
      backendToken = sessionStorage.getItem('backend_token')
      if (backendToken) {
        localStorage.setItem('backend_token', backendToken)
      }
    }
    if (backendToken) {
      try {
        const payload = JSON.parse(atob(backendToken.split('.')[1]))
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          logout()
          saveRedirect()
          window.location.assign('/login')
          return
        }
      } catch {
        // malformed token — treat as expired
        logout()
        saveRedirect()
        window.location.assign('/login')
        return
      }

      getCurrentUser()
        .then((u) => {
          setUser(u)
        })
        .catch(() => {
          logout()
          saveRedirect()
          window.location.assign('/login')
        })
        .finally(() => setLoading(false))
      return
    }

    // Fall back to OIDC token check
    Promise.resolve(oidcManager?.getUser()).then((oidcUser) => {
      if (oidcUser?.expired) {
        logout()
        saveRedirect()
        window.location.assign('/login')
        return
      }

      getCurrentUser()
        .then((u) => {
          setUser(u)
        })
        .catch(() => {
          logout()
          saveRedirect()
          window.location.assign('/login')
        })
        .finally(() => setLoading(false))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback((loggedInUser: User) => {
    setUser(loggedInUser)
    setIsAuthenticated(true)
    localStorage.setItem(AUTH_KEY, 'true')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem('backend_token')
    localStorage.removeItem(REDIRECT_KEY)
    sessionStorage.removeItem('oauth_state')
    // Clear OIDC session without redirecting (silent local logout)
    oidcManager?.removeUser()
  }, [])

  // Global 401 handler: any API call returning 401 logs the user out and
  // redirects to the login page.
  useEffect(() => {
    setOnUnauthorized(() => {
      logout()
      saveRedirect()
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
