import { createContext } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types'

// A socket that knows every event name and payload, so a typo or a wrong field fails the build.
export type TripSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface SocketState {
  // Null while logged out.
  socket: TripSocket | null
  connected: boolean
}

export const SocketContext = createContext<SocketState>({ socket: null, connected: false })
