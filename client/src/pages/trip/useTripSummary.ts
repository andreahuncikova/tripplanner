import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TripState, TripSummary } from '@shared/types'
import { ApiError, api } from '../../lib/api'
import { useToast } from '../../components/ui'
import { useJoinTrip } from '../../socket/useJoinTrip'
import { useSocket } from '../../socket/useSocket'

// The trip as its members see it (the trip header and Trip settings), kept up to date while the screen is open:
// it opens the trip on the socket and takes the name, members and dates from every 'state' the server sends.
// Someone who is not a member goes to "Join a trip"; when the organiser deletes the trip, everyone goes back to their trips.
export function useTripSummary(code: string) {
  const { socket } = useSocket()
  const navigate = useNavigate()
  const toast = useToast()
  const [trip, setTrip] = useState<TripSummary | null>(null)

  useJoinTrip(code)

  // The public preview is not used here, because it is limited against guessing codes
  // and could then leave the header without a name.
  const reload = useCallback(() => {
    api<TripSummary>(`/api/groups/${code}/summary`)
      .then(setTrip)
      .catch(err => {
        setTrip(null)
        // A shared trip link opened by someone who is not in the trip: "Join a trip" with the code filled in
        if (err instanceof ApiError && err.status === 404) navigate(`/join?code=${encodeURIComponent(code)}`, { replace: true })
      })
  }, [code, navigate])

  useEffect(() => {
    setTrip(null)
    reload()
  }, [reload])

  useEffect(() => {
    if (!socket) return
    const onState = (s: TripState) => {
      if (s.inviteCode !== code) return
      setTrip(t => t && {
        ...t,
        name: s.name, phase: s.phase, members: s.members, currency: s.currency,
        adminUserId: s.adminUserId, adminUsername: s.adminUsername, approvedDest: s.approvedDest, datesKnown: s.datesKnown,
        finalDate: s.finalDate, finalDateLabel: s.finalDateLabel, tripDuration: s.tripDuration,
        tripWindowStart: s.tripWindowStart, tripWindowEnd: s.tripWindowEnd,
      })
    }
    // The server does not send this to the organiser who deleted it, so they only see their own "Trip deleted"
    const onDeleted = () => {
      toast('The organiser deleted this trip')
      navigate('/dashboard', { replace: true })
    }
    socket.on('state', onState)
    socket.on('group:deleted', onDeleted)
    return () => {
      socket.off('state', onState)
      socket.off('group:deleted', onDeleted)
    }
  }, [socket, code, navigate, toast])

  return { trip, reload }
}
