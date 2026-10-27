import { createContext } from 'react'
import type { Socket } from 'socket.io-client'

export interface SocketState {
  // Null while logged out.
  socket: Socket | null
  connected: boolean
}

export const SocketContext = createContext<SocketState>({ socket: null, connected: false })
