import { useEffect, useState, type ReactNode } from 'react'
import type { TripCover, TripPhotos } from '@shared/types'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { api } from '../../../lib/api'
import { backStep } from '../../../lib/plan'
import type { TripPlan } from '../../../socket/useTripPlan'
import { Button, ConfirmModal } from '../../../components/ui'
import { BackIcon, BudgetIcon, ItineraryIcon, StaysIcon } from '../../../components/layout/icons'
import DatesStep from './DatesStep'
import DestinationStep from './DestinationStep'
import { StepCard } from './StepGuide'
import type { StepProps } from './step'

// The Plan tab: the step the group is in now. The steps and their order are the old app's phases
// (destinations → calendar → date_vote → done); steps skipped when the trip was created are never shown.
export default function PlanSection({ plan }: { plan: TripPlan }) {
  const { user } = useAuth()
  const state = plan.state
  if (!state || !user) return <p className="text-muted">Loading the plan…</p>

  const props: StepProps = {
    plan,
    state,
    me: user._id,
    isOrganiser: state.adminUserId === user._id,
    organiser: state.members.find(m => m.userId === state.adminUserId)?.username ?? state.adminUsername,
  }
  const datesStep = state.phase === 'calendar' || state.phase === 'date_vote'

  return (
    <div className="flex w-full flex-1 flex-col gap-6 lg:min-h-0">
      {state.phase === 'destinations' && <DestinationStep {...props} />}
      {datesStep && <DatesStep {...props} />}
      {state.phase === 'done' && <ReadyStep {...props} />}
      {props.isOrganiser && <BackStep {...props} />}
    </div>
  )
}

// The destination and the dates are agreed, so the planning steps are done; the rest of the trip is planned in the other tabs.
// Each of the three tiles is a photo of the destination from Unsplash (a stay, something to see, food), searched once
// by the server; without one it has a dark background with the tab's icon.
function ReadyStep({ state }: StepProps) {
  const [photos, setPhotos] = useState<TripPhotos | null>(null)
  useEffect(() => {
    let current = true
    api<TripPhotos>(`/api/groups/${state.inviteCode}/photos`).then(p => { if (current) setPhotos(p) }).catch(() => {})
    return () => { current = false }
  }, [state.inviteCode, state.approvedDest])

  // No min-h-0 on the section: on a low window the tiles keep their height and the page scrolls,
  // instead of running over Go back a step
  return (
    <section aria-label="Plan" className="flex flex-1 flex-col gap-4">
      {/* What the group agreed on is written next to the ticked steps in the dark card */}
      <StepCard step="done" title="You're ready to go" agreed={[state.approvedDest, state.finalDateLabel]}>
        The group agreed on where and when. Save places to stay in the Stays tab, plan the days in the Itinerary and add shared costs in the Budget.
      </StepCard>
      <div className="grid gap-3 sm:grid-cols-3 lg:min-h-64 lg:flex-1 lg:gap-4">
        <Tile to={`/trips/${state.inviteCode}/stays`} icon={StaysIcon} photo={photos?.stays} title="Save stays" text="Paste links from Booking or Airbnb, like the ones you want and mark the one you book." />
        <Tile to={`/trips/${state.inviteCode}/itinerary`} icon={ItineraryIcon} photo={photos?.days} title="Plan the days" text="Add what you want to do, day by day, and ideas for later." />
        <Tile to={`/trips/${state.inviteCode}/budget`} icon={BudgetIcon} photo={photos?.costs} title="Add shared costs" text="Note who paid for what, in any currency, and see your share." />
      </div>
    </section>
  )
}

// A photo with the tab's name and what to do there on a dark fade at the bottom. Unsplash asks for the photographer
// to be named with a link, so a small credit sits at the top, on the tile but outside its link.
function Tile({ to, icon: Icon, photo, title, text }: { to: string; icon: () => ReactNode; photo?: TripCover | null; title: string; text: string }) {
  return (
    <div className="relative flex min-h-56 sm:min-h-72 lg:min-h-0">
      <Link
        to={to}
        className="group relative isolate flex flex-1 flex-col justify-end gap-1.5 overflow-hidden rounded-[18px] bg-linear-to-br from-sommet to-roche p-5 text-white no-underline shadow-card transition-shadow hover:text-white hover:shadow-raised lg:gap-2 lg:p-6"
      >
        {photo ? (
          <img src={photo.url} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span aria-hidden="true" className="absolute inset-x-0 top-[38%] -z-10 flex -translate-y-1/2 justify-center text-white/20 [&_svg]:size-20 [&_svg]:stroke-[1.2] lg:[&_svg]:size-24"><Icon /></span>
        )}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-linear-to-t from-black/85 via-black/45 to-transparent" />
        {photo && <span aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-14 bg-linear-to-b from-black/45 to-transparent" />}
        <strong className="flex items-center justify-between gap-2 text-lg lg:text-xl">
          {title}<span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </strong>
        <span className="text-sm text-white/85">{text}</span>
      </Link>
      {photo && (
        <p className="absolute top-2.5 right-3.5 left-3.5 truncate text-right text-[10px] text-white/70">
          <a href={photo.authorUrl} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white">{photo.author}</a>
          {' / '}<a href="https://unsplash.com/?utm_source=tripplanner&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white">Unsplash</a>
        </p>
      )}
    </div>
  )
}

// Only the organiser can move the whole group back one step. It deletes the data of the step, so it asks first.
function BackStep({ plan, state }: StepProps) {
  const [open, setOpen] = useState(false)
  const step = backStep(state)
  if (!step) return null
  return (
    // Always the last row of the Plan tab, at the bottom of the window (the step above takes the free height)
    <div className="mt-auto flex border-t border-line pt-4">
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="gap-1.5 pl-2.5 [&_svg]:size-4.5">
        <BackIcon />Go back a step
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        title={step.title}
        text={`${step.text} Everyone in the trip sees the change.`}
        confirm="Go back"
        onConfirm={() => { plan.back(); setOpen(false) }}
      />
    </div>
  )
}
