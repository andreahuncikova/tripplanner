import { useOutletContext } from 'react-router-dom'
import type { TripChat } from '../../socket/useTripChat'

// What TripLayout hands to the section shown in its <Outlet />.
export interface TripOutlet {
  chat: TripChat
}

export const useTripOutlet = () => useOutletContext<TripOutlet>()
