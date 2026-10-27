import { createContext } from 'react'
import type { User } from '../types'

export interface AuthState {
  user: User | null
  token: string | null
  // True while the saved token is being checked on page load.
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
