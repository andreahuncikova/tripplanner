import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import type { TripPreview } from '@shared/types'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import {
  BackIcon, BudgetIcon, ChatIcon, CloseIcon, ItineraryIcon, MoreIcon, PlanIcon, StaysIcon,
} from '../../components/layout/icons'
import ChatPanel from './ChatPanel'

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
  const [trip, setTrip] = useState<TripPreview | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    api<TripPreview>(`/api/groups/${tripId}`).then(setTrip).catch(() => setTrip(null))
  }, [tripId])

  return (
    <div className="flex min-h-dvh flex-col pb-24 lg:pb-0">
      <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-line bg-white px-3 pt-3 pb-2.5 lg:static lg:px-8 lg:pt-6 lg:pb-0">
        <div className="flex items-center gap-1 lg:gap-4">
          <Link to="/dashboard" aria-label="Back to trips" className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
            <BackIcon />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-lead font-bold lg:text-2xl lg:font-extrabold">{trip?.name ?? 'Trip'}</h1>
            {trip && (
              <span className="text-caption text-muted lg:text-sm">
                {trip.memberCount} {trip.memberCount === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>
          <button type="button" className="rounded-md bg-ciel-light px-3.5 py-2.5 text-sm font-bold text-sommet">Invite</button>
          <button type="button" aria-label="Trip settings" className="flex size-11 items-center justify-center rounded-md text-subtle lg:border lg:border-line">
            <MoreIcon />
          </button>
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

      <main className="flex-1 px-5 py-4 lg:px-8 lg:py-7">
        <Outlet />
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

      {/* Desktop: the chat window and the bubble that opens it. */}
      {chatOpen && (
        <section aria-label="Group chat" className="fixed right-7 bottom-26 z-30 hidden h-150 max-h-[calc(100dvh-140px)] w-95 flex-col overflow-hidden rounded-xl border border-line bg-white shadow-float lg:flex">
          <header className="flex items-center gap-3 border-b border-line py-3.5 pr-4 pl-5">
            <strong className="flex-1">Group chat</strong>
            <button type="button" aria-label="Close chat" onClick={() => setChatOpen(false)} className="flex size-10 items-center justify-center rounded-[10px] text-subtle hover:bg-canvas">
              <CloseIcon />
            </button>
          </header>
          <ChatPanel />
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
        {chatOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  )
}
