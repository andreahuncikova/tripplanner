import { useCallback, useEffect, useState } from 'react'
import type { Area, Stay, StaysState } from '@shared/types'
import { useSocket } from './useSocket'

export interface TripStays {
  areas: Area[]
  stays: Stay[]            // newest first
  loaded: boolean          // the list arrived from the server and the trip is open, so stays can be added
  // Resolves with an error message, or null when the stay was saved
  add: (url: string, areaId: string | null) => Promise<string | null>
  like: (stayId: string) => void
  move: (stayId: string, areaId: string | null) => void
  remove: (stayId: string) => void
  // Resolves with the new area's id, or with an error
  addArea: (name: string) => Promise<{ id: string } | { error: string }>
  renameArea: (id: string, name: string) => void
}

// How long we wait for the server to save a stay: it first reads the link (up to 8 s), then saves it
const ADD_TIMEOUT_MS = 20_000

// The stays and areas of the trip that useJoinTrip() opened. Kept in TripLayout like the chat,
// so the list is there at once when the Stays tab opens. The server sends the whole list after every change,
// so what everyone sees is always the same.
export function useTripStays(code: string): TripStays {
  const { socket } = useSocket()
  const [state, setState] = useState<StaysState>({ areas: [], stays: [] })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!socket) return
    // Nothing from the previous trip may show while this one loads
    setState({ areas: [], stays: [] })
    setLoaded(false)
    // The server sends the list right after it opened the trip on our socket, so from then on adding works.
    // After a lost connection it does not, until the trip is joined again and the list comes again.
    const onStays = (data: StaysState) => { setState(data); setLoaded(true) }
    const onDisconnect = () => setLoaded(false)
    socket.on('stays', onStays)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('stays', onStays)
      socket.off('disconnect', onDisconnect)
    }
  }, [socket, code])

  const add = useCallback((url: string, areaId: string | null) => new Promise<string | null>(resolve => {
    if (!socket?.connected) return resolve('You are offline — please try again')
    socket.timeout(ADD_TIMEOUT_MS).emit('stay:add', { url, areaId }, (err: Error | null, result: { ok: true } | { error: string }) => {
      if (err) return resolve('The server did not answer — please try again')
      resolve('error' in result ? result.error : null)
    })
  }), [socket])

  const addArea = useCallback((name: string) => new Promise<{ id: string } | { error: string }>(resolve => {
    if (!socket?.connected) return resolve({ error: 'You are offline — please try again' })
    socket.timeout(ADD_TIMEOUT_MS).emit('area:add', name, (err: Error | null, result: { ok: true; id: string } | { error: string }) => {
      if (err) return resolve({ error: 'The server did not answer — please try again' })
      resolve('error' in result ? result : { id: result.id })
    })
  }), [socket])

  const like = useCallback((id: string) => { socket?.emit('stay:like', id) }, [socket])
  const move = useCallback((id: string, areaId: string | null) => { socket?.emit('stay:move', { id, areaId }) }, [socket])
  const remove = useCallback((id: string) => { socket?.emit('stay:remove', id) }, [socket])
  const renameArea = useCallback((id: string, name: string) => { socket?.emit('area:rename', { id, name }) }, [socket])

  return { ...state, loaded, add, like, move, remove, addArea, renameArea }
}
