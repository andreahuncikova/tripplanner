import { useEffect, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '../auth/useAuth'
import { API_URL } from '../lib/api'
import { SocketContext } from './SocketContext'

// One socket connection for the whole app, open while someone is logged in.
// Screens use it through useSocket(); a trip screen emits 'join' with the trip's code.
export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    // The server checks this token before it accepts the connection (socketAuth on the server).
    // With an empty API_URL the socket connects to the page's own origin, which Vite proxies in development.
    const s = io(API_URL || undefined, { auth: { token } })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    setSocket(s)

    // Log out or a new token: close this connection.
    return () => {
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [token])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}
