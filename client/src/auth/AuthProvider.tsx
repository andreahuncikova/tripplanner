import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, getToken, setToken as saveToken } from '../lib/api'
import type { User } from '@shared/types'
import { AuthContext } from './AuthContext'

interface AuthResponse {
  token: string
  user: User
}

// Keeps the logged-in user for the whole app. On page load it asks the server who the saved token belongs to.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getToken)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(token !== null)

  useEffect(() => {
    if (!token) return
    api<{ user: User }>('/api/auth/me')
      .then(r => setUser(r.user))
      // Only a token the server rejects (401: expired, invalid, or the password was changed) is forgotten.
      // When the server or the database is down (503, 500, no connection) the token is kept for the next visit.
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) { saveToken(null); setToken(null) }
      })
      .finally(() => setLoading(false))
    // Only on page load; login and register set the user themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function signIn(r: AuthResponse) {
    saveToken(r.token)
    setToken(r.token)
    setUser(r.user)
  }

  async function login(email: string, password: string) {
    signIn(await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }))
  }

  async function register(username: string, email: string, password: string) {
    signIn(await api<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }))
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    saveToken(null)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
