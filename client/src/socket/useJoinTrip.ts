import { useEffect } from 'react'
import { useSocket } from './useSocket'

// Opens one trip on the server while its screen is shown: the socket joins the trip's room, so its messages,
// online list and changes arrive. Joins again after a reconnect, because the server forgets the room then.
export function useJoinTrip(code: string) {
  const { socket, connected } = useSocket()

  useEffect(() => {
    if (!socket || !connected || !code) return
    socket.emit('join', { code })

    // Another trip or another page: leave this one. Not while offline, because socket.io would send it after the reconnect.
    return () => {
      if (socket.connected) socket.emit('trip:close')
    }
  }, [socket, connected, code])
}
