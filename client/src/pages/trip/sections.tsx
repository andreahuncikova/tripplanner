import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ChatPanel from './ChatPanel'
import ItineraryView from './itinerary/ItinerarySection'
import StaysView from './StaysSection'
import PlanView from './plan/PlanSection'
import BudgetView from './budget/BudgetSection'
import { useTripOutlet } from './tripOutlet'

// The trip's sections, each given what it needs from TripLayout (tripOutlet.ts)
export function PlanSection() {
  const { plan } = useTripOutlet()
  return <PlanView plan={plan} />
}
export function StaysSection() {
  const { stays, trip } = useTripOutlet()
  return <StaysView stays={stays} trip={trip} />
}
export function ItinerarySection() {
  const { plan, stays } = useTripOutlet()
  return <ItineraryView plan={plan} stays={stays} />
}

// /trips/:tripId opens the Itinerary once the destination and the dates are agreed, because then the days
// are what the group looks at; before that it opens the Plan with the step the group is in
export function TripIndex() {
  const { plan } = useTripOutlet()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const phase = plan.state?.phase
  useEffect(() => {
    // The trip loads for a moment first. Someone who already tapped another link meanwhile (Trip settings)
    // must not be sent back, so the address is checked again right before moving on.
    if (!phase || window.location.pathname !== pathname) return
    navigate(`${pathname.replace(/\/$/, '')}/${phase === 'done' ? 'itinerary' : 'plan'}`, { replace: true })
  }, [phase, pathname, navigate])
  return null
}
export function BudgetSection() {
  const { plan } = useTripOutlet()
  return <BudgetView plan={plan} />
}

// On phones the chat is its own tab and fills the screen. Desktop opens it from the bubble instead,
// but someone who widens the window on this tab still sees it in a card.
export function ChatSection() {
  const { chat, stays, trip } = useTripOutlet()
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-150 lg:overflow-hidden lg:rounded-xl lg:border lg:border-line">
      <ChatPanel chat={chat} stays={stays} members={trip?.members} />
    </div>
  )
}
