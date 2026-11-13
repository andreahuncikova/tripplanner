import { useOutletContext } from 'react-router-dom'
import type { TripSummary } from '@shared/types'
import type { TripChat } from '../../socket/useTripChat'
import type { TripPlan } from '../../socket/useTripPlan'
import type { TripStays } from '../../socket/useTripStays'

// What TripLayout hands to the section shown in its <Outlet />.
export interface TripOutlet {
  chat: TripChat
  plan: TripPlan
  stays: TripStays
  // null while it loads
  trip: TripSummary | null
}

export const useTripOutlet = () => useOutletContext<TripOutlet>()
