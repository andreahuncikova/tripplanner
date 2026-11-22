import { createContext } from 'react'
import type { User } from '@shared/types'

export interface AuthState {
  user: User | null
  token: string | null
  // True while the saved token is being checked on page load.
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  // After a change in the profile: the new user, and a new token when the server sent one
  updateSession: (r: { token?: string; user: User }) => void
  // Asks the server again who is logged in (e.g. after the new e-mail was confirmed)
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
