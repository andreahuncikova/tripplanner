import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useParams } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { people } from '../../lib/trips'
import { useTripChat } from '../../socket/useTripChat'
import { useTripPlan } from '../../socket/useTripPlan'
import { useTripStays } from '../../socket/useTripStays'
import {
  BackIcon, BudgetIcon, ChatIcon, ChevronDownIcon, CloseIcon, ItineraryIcon, MoreIcon, PlanIcon, StaysIcon,
} from '../../components/layout/icons'
import ChatPanel from './ChatPanel'
import InviteModal from './InviteModal'
import OnlineStatus from './OnlineStatus'
import type { TripOutlet } from './tripOutlet'
import { useTripSummary } from './useTripSummary'

const sections = [
  { path: 'plan', label: 'Plan', icon: PlanIcon },
  { path: 'stays', label: 'Stays', icon: StaysIcon },
  { path: 'itinerary', label: 'Itinerary', icon: ItineraryIcon },
  { path: 'budget', label: 'Budget', icon: BudgetIcon },
]

// The frame of one trip. Phones: header on top, the sections as tabs at the bottom, chat as the fifth tab.
// Desktop: the sections as tabs under the trip name, and the chat in a window opened from a bubble.
export default function TripLayout() {
  const { tripId = '' } = useParams()
  const [chatOpen, setChatOpen] = useState(false)
  // A trip that was just created opens with "Invite friends" (NewTrip sends { invite: true })
  const location = useLocation()
  const [inviteOpen, setInviteOpen] = useState(() => (location.state as { invite?: boolean } | null)?.invite === true)
  // The phone chat tab fills the screen between the header and the tabs, and only its messages scroll.
  const onChatTab = useMatch('/trips/:tripId/chat') !== null

  // Live updates for this trip (it also opens the trip on the socket). The chat lives here and not in ChatPanel,
  // so nothing is missed while the chat window is closed or another tab is open.
  const { trip } = useTripSummary(tripId)
  const chat = useTripChat(tripId)
  const plan = useTripPlan(tripId)
  const stays = useTripStays(tripId)

  return (
    <div className={cn('flex flex-col pb-24 lg:min-h-dvh lg:pb-0', onChatTab ? 'h-dvh lg:h-auto' : 'min-h-dvh')}>
      <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-line bg-white px-3 pt-3 pb-2.5 lg:static lg:px-8 lg:pt-6 lg:pb-0">
        <div className="flex items-center gap-1 lg:gap-4">
          <Link to="/dashboard" aria-label="Back to trips" className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
            <BackIcon />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-lead font-bold lg:text-2xl lg:font-extrabold">{trip?.name ?? 'Trip'}</h1>
            {onChatTab && <span className="lg:hidden"><OnlineStatus online={chat.online} /></span>}
            {trip && <span className={cn('text-caption text-muted lg:text-sm', onChatTab && 'hidden lg:inline')}>{people(trip.members.length)}</span>}
          </div>
          <button type="button" onClick={() => setInviteOpen(true)} className="rounded-md bg-ciel-light px-3.5 py-2.5 text-sm font-bold text-sommet hover:bg-ciel/40">Invite</button>
          <Link to={`/trips/${tripId}/settings`} aria-label="Trip settings" className="flex size-11 items-center justify-center rounded-md text-subtle hover:text-roche lg:border lg:border-line">
            <MoreIcon />
          </Link>
        </div>

        <nav aria-label="Trip sections" className="hidden gap-7 lg:flex">
          {sections.map(s => (
            <NavLink
              key={s.path}
              to={s.path}
              className={({ isActive }) => cn(
                'border-b-3 pb-3.5',
                isActive ? 'border-sommet font-bold text-sommet' : 'border-transparent font-semibold text-subtle hover:text-roche',
              )}
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={cn('flex-1 lg:px-8 lg:py-7', onChatTab ? 'flex min-h-0 flex-col lg:block' : 'px-5 py-4')}>
        <Outlet context={{ chat, plan, stays, trip } satisfies TripOutlet} />
      </main>

      {/* Phones: the sections and the chat as tabs at the bottom. */}
      <nav aria-label="Trip" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-white px-2 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden">
        {[...sections, { path: 'chat', label: 'Chat', icon: ChatIcon }].map(s => (
          <NavLink
            key={s.path}
            to={s.path}
            className={({ isActive }) => cn(
              'flex min-w-16 flex-col items-center gap-0.75 p-1 text-2xs',
              isActive ? 'font-bold text-sommet' : 'font-semibold text-muted hover:text-roche',
            )}
          >
            <s.icon />
            {s.label}
          </NavLink>
        ))}
      </nav>

      {trip && <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} trip={trip} />}

      {/* Desktop: the chat window and the bubble that opens it. */}
      {chatOpen && (
        <section aria-label="Group chat" className="fixed right-7 bottom-26 z-30 hidden h-150 max-h-[calc(100dvh-260px)] w-95 flex-col overflow-hidden rounded-xl border border-line bg-white shadow-float lg:flex">
          <header className="flex items-center gap-3 border-b border-line pt-4 pr-4 pb-3.5 pl-5">
            <div className="flex min-w-0 flex-1 flex-col">
              <strong>Group chat</strong>
              <OnlineStatus online={chat.online} names />
            </div>
            <button type="button" aria-label="Close chat" onClick={() => setChatOpen(false)} className="flex size-10 items-center justify-center rounded-[10px] text-subtle hover:bg-canvas">
              <CloseIcon />
            </button>
          </header>
          <ChatPanel chat={chat} stays={stays} inWindow />
        </section>
      )}
      <button
        type="button"
        aria-label={chatOpen ? 'Close group chat' : 'Open group chat'}
        aria-expanded={chatOpen}
        onClick={() => setChatOpen(o => !o)}
        className={cn(
          'fixed right-7 bottom-7 z-30 hidden size-15 items-center justify-center rounded-full text-white shadow-float lg:flex',
          chatOpen ? 'bg-roche' : 'bg-sommet hover:bg-sommet-dark',
        )}
      >
        {chatOpen ? <ChevronDownIcon /> : <ChatIcon />}
      </button>
    </div>
  )
}
