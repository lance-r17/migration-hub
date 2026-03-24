import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '@/services/users'
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
    getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false))
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
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, isAuthenticated, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): UserContextValue {
  return useContext(UserContext)
}
