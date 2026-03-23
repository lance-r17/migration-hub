import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { mockCurrentUser } from '@/data/mock'
import type { User } from '@/types'

const UserContext = createContext<User>(mockCurrentUser)

export function UserProvider({ children }: { children: ReactNode }) {
  return (
    <UserContext.Provider value={mockCurrentUser}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): User {
  return useContext(UserContext)
}
