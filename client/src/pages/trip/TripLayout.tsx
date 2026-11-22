import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useParams } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { countdown, people } from '../../lib/trips'
import { useTripChat } from '../../socket/useTripChat'
import { useTripPlan } from '../../socket/useTripPlan'
import { useTripStays } from '../../socket/useTripStays'
import {
  BackIcon, BudgetIcon, ChatIcon, ChevronDownIcon, CloseIcon, InviteIcon, ItineraryIcon, MoreIcon, PlanIcon, StaysIcon,
} from '../../components/layout/icons'
import { AvatarGroup } from '../../components/ui'
import ChatPanel from './ChatPanel'
import InviteModal from './InviteModal'
import OnlineStatus from './OnlineStatus'
import { PLAN_STEPS, currentStep } from '../../lib/plan'
import { PlanProgress } from './plan/StepGuide'
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
  // The planning steps show above Plan, Itinerary and Budget. Stays has its own bar of booked nights in the mockups,
  // and the chat needs the whole screen.
  const section = useMatch('/trips/:tripId/:section')?.params.section
  const showSteps = section === 'plan' || section === 'itinerary' || section === 'budget'

  // Live updates for this trip (it also opens the trip on the socket). The chat lives here and not in ChatPanel,
  // so nothing is missed while the chat window is closed or another tab is open.
  const { trip } = useTripSummary(tripId)
  const chat = useTripChat(tripId)
  const plan = useTripPlan(tripId)
  const stays = useTripStays(tripId)

  return (
    <div className={cn('flex flex-col pb-24 lg:min-h-dvh lg:pb-0', onChatTab ? 'h-dvh lg:h-auto' : 'min-h-dvh')}>
      {/* Desktop: on the page itself; the countdown to the trip on the left, the sections as a switch
          in the middle, the people and actions on the right. The trip's name, place and dates are in the sidebar there,
          so the name here is only for screen readers. */}
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-white px-3 pt-3 pb-2.5 lg:static lg:mx-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6 lg:border-0 lg:bg-transparent lg:px-0 lg:py-5">
        <Link to="/dashboard" aria-label="Back to trips" className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
          <BackIcon />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col lg:sr-only">
          <h1 className="truncate text-lead font-bold lg:text-title lg:font-extrabold">{trip?.name ?? 'Trip'}</h1>
          {onChatTab && <span className="lg:hidden"><OnlineStatus online={chat.online} /></span>}
          {trip && <span className={cn('text-caption text-muted lg:hidden', onChatTab && 'hidden')}>{people(trip.members.length)}</span>}
        </div>
        <div className="hidden lg:block">
          {trip && countdown(trip) && (
            <span className="inline-flex h-10 items-center gap-2 rounded-md bg-roche px-4 text-sm font-semibold text-white shadow-raised [&_svg]:size-4.5 [&_svg]:text-ciel">
              <ItineraryIcon />{countdown(trip)}
            </span>
          )}
        </div>

        <nav aria-label="Trip sections" className="hidden h-10 gap-1 rounded-md bg-roche p-1 shadow-raised lg:flex">
          {sections.map(s => (
            <NavLink
              key={s.path}
              to={s.path}
              className={({ isActive }) => cn(
                'flex items-center gap-2 rounded-sm px-4 text-sm whitespace-nowrap transition-colors [&_svg]:size-4 xl:px-5',
                isActive ? 'bg-white font-semibold text-roche [&_svg]:text-sommet' : 'font-medium text-white/70 hover:bg-white/5 hover:text-white',
              )}
            >
              <s.icon />{s.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop: one dark box like the switch, with the members, Invite and the settings */}
        <div className="flex items-center gap-1 lg:h-10 lg:justify-self-end lg:rounded-md lg:bg-roche lg:p-1 lg:shadow-raised">
          {trip && (
            <span className="hidden px-2 xl:block" title={people(trip.members.length)}>
              <AvatarGroup people={trip.members.map(m => ({ name: m.username, color: m.color }))} max={4} />
            </span>
          )}
          <button type="button" onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 rounded-md bg-ciel-light px-3.5 py-2.5 text-sm font-bold text-sommet hover:bg-ciel/40 lg:h-full lg:rounded-sm lg:bg-transparent lg:px-3.5 lg:py-0 lg:text-sm lg:font-medium lg:text-white/80 lg:hover:bg-white/10 lg:hover:text-white lg:[&_svg]:text-ciel">
            <span className="hidden lg:inline"><InviteIcon /></span>Invite
          </button>
          <Link to={`/trips/${tripId}/settings`} aria-label="Trip settings" className="flex size-11 items-center justify-center rounded-md text-subtle hover:bg-canvas hover:text-roche lg:size-8 lg:rounded-sm lg:text-white/70 lg:hover:bg-white/10 lg:hover:text-white">
            <MoreIcon />
          </Link>
        </div>
      </header>

      {/* Once every step is done the itinerary does not repeat it: the header already says where and when */}
      {showSteps && plan.state && !(section === 'itinerary' && currentStep(plan.state.phase, stays.stays.length) === PLAN_STEPS.length - 1) && (
        <div className="border-b border-line bg-white px-5 pt-3 pb-3.5 lg:border-0 lg:bg-transparent lg:px-8 lg:pt-7 lg:pb-0">
          {/* On the Plan tab as wide as the step below it */}
          <div className={cn('mx-auto w-full', section === 'plan' && (plan.state.phase === 'calendar' || plan.state.phase === 'date_vote' ? 'lg:max-w-245' : 'lg:max-w-180'))}>
            <PlanProgress state={plan.state} stayCount={stays.stays.length} />
          </div>
        </div>
      )}

      <main className={cn('flex-1 lg:px-8 lg:pt-10 lg:pb-7', onChatTab ? 'flex min-h-0 flex-col lg:block' : 'px-5 py-4 lg:pb-24')}>
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

      {/* Desktop: the chat window and the bubble that opens it. Not on the Chat tab itself, where the chat is open
          already and the bubble would cover its Send button on a smaller laptop. */}
      {chatOpen && !onChatTab && (
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
      {!onChatTab && <button
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
      </button>}
    </div>
  )
}
