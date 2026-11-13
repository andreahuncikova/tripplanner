import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TripState } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { useSocket } from './useSocket'

export interface TripPlan {
  // The whole trip as the server sends it; null while it loads
  state: TripState | null
  suggest: (name: string) => void
  vote: (destinationId: string) => void
  approve: (destinationId: string) => void
  removeDestination: (destinationId: string) => void
  // All the days the user cannot travel, as "YYYY-MM-DD"
  setUnavailable: (days: string[]) => void
  setDone: (done: boolean) => void
  setWindow: (start: string, end: string) => void
  setLength: (days: number) => void
  findFreeDates: () => void
  voteRange: (index: number) => void
  confirmRange: (index: number, start: string) => void
  back: () => void
}

// The planning steps of the trip that useJoinTrip() opened: destinations, marked days, free windows and votes.
// Kept in TripLayout like the chat, so nothing is missed while another tab is open.
// The server sends the whole trip after most changes, and smaller updates for suggestions, marked days and date votes.
export function useTripPlan(code: string): TripPlan {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [state, setState] = useState<TripState | null>(null)

  useEffect(() => {
    if (!socket) return
    // Nothing from the previous trip may show while this one loads
    setState(null)

    // An update meant for a trip that was just closed is ignored
    const onState = (s: TripState) => { if (s.inviteCode === code) setState(s) }
    const onDest = (d: TripState['destinations'][number]) =>
      setState(s => s && (s.destinations.some(x => x._id === d._id) ? s : { ...s, destinations: [...s.destinations, d] }))
    const onAvail = (a: TripState['availability'][number]) =>
      setState(s => s && { ...s, availability: [...s.availability.filter(x => x.userId !== a.userId), a] })
    const onRanges = (dateRanges: TripState['dateRanges']) => setState(s => s && { ...s, dateRanges })

    socket.on('joined', onState)
    socket.on('state', onState)
    socket.on('dest:new', onDest)
    socket.on('avail:update', onAvail)
    socket.on('range:votes', onRanges)
    return () => {
      socket.off('joined', onState)
      socket.off('state', onState)
      socket.off('dest:new', onDest)
      socket.off('avail:update', onAvail)
      socket.off('range:votes', onRanges)
    }
  }, [socket, code])

  // The calendar changes at once on the user's own screen; the server sends the same days back to everyone
  const setUnavailable = useCallback((days: string[]) => {
    if (!socket || !user) return
    setState(s => s && {
      ...s,
      availability: [
        ...s.availability.filter(a => a.userId !== user._id),
        { userId: user._id, username: user.username, color: user.color, unavailableDates: days },
      ],
    })
    socket.emit('avail:set', days)
  }, [socket, user])

  const actions = useMemo(() => ({
    suggest: (name: string) => socket?.emit('dest:suggest', name),
    vote: (id: string) => socket?.emit('dest:vote', id),
    approve: (id: string) => socket?.emit('dest:approve', id),
    removeDestination: (id: string) => socket?.emit('dest:remove', id),
    setDone: (done: boolean) => socket?.emit(done ? 'avail:ready' : 'avail:unready'),
    setWindow: (start: string, end: string) => socket?.emit('trip:setWindow', { start, end }),
    setLength: (days: number) => socket?.emit('trip:setDuration', days),
    findFreeDates: () => socket?.emit('avail:compute'),
    voteRange: (idx: number) => socket?.emit('range:vote', idx),
    confirmRange: (idx: number, start: string) => socket?.emit('range:confirm', { idx, start }),
    back: () => socket?.emit('phase:back'),
  }), [socket])

  return { state, setUnavailable, ...actions }
}
