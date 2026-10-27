// Address of the server. Empty in development (Vite proxies /api to localhost:3000);
// on Vercel it is set to the Render URL with VITE_API_URL.
export const API_URL = import.meta.env.VITE_API_URL ?? ''

const TOKEN_KEY = 'tp_token'

// The log-in token is kept in localStorage and sent in the Authorization header,
// because a cookie from the Render domain is not sent from the Vercel domain.
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

// An error answer from the server, with its HTTP status, so callers can tell
// "your token is not valid" (401) apart from "the server has a problem right now" (503, 500).
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })
  // The server answers errors as { error: "message" }; pass that message on to the screen.
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `${res.status} ${res.statusText}`, res.status)
  return data
}
