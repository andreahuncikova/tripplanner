import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { cn } from '../../../lib/cn'
import { backStep } from '../../../lib/plan'
import type { TripPlan } from '../../../socket/useTripPlan'
import { Button, ConfirmModal } from '../../../components/ui'
import DatesStep from './DatesStep'
import DestinationStep from './DestinationStep'
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
    <div className={cn('mx-auto flex w-full flex-col gap-6', datesStep ? 'max-w-245' : 'max-w-180')}>
      {state.phase === 'destinations' && <DestinationStep {...props} />}
      {datesStep && <DatesStep {...props} />}
      {state.phase === 'done' && <ReadyStep {...props} />}
      {props.isOrganiser && <BackStep {...props} />}
    </div>
  )
}

// The destination and the dates are agreed; the rest of the trip is planned in the other tabs
function ReadyStep({ state }: StepProps) {
  const rows = [
    { label: 'Destination', value: state.approvedDest ?? 'Not chosen' },
    { label: 'Dates', value: state.finalDateLabel ?? 'Not chosen' },
  ]
  const link = 'flex-1 rounded-md px-5 py-3 text-center font-bold no-underline'
  return (
    <section aria-labelledby="ready-title" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 id="ready-title" className="text-lg font-extrabold">The trip is planned</h2>
        <p className="text-sm text-muted">The group agreed on where and when. Now save stays and plan the days.</p>
      </header>
      <dl className="flex flex-col rounded-lg bg-white">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 last:border-b-0 lg:px-5">
            <dt>{r.label}</dt>
            <dd className="flex items-center gap-2 font-bold"><span aria-hidden="true" className="text-success">✓</span>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link to={`/trips/${state.inviteCode}/stays`} className={cn(link, 'bg-sommet text-white hover:bg-sommet-dark hover:text-white')}>Save stays</Link>
        <Link to={`/trips/${state.inviteCode}/itinerary`} className={cn(link, 'bg-ciel-light text-sommet hover:text-sommet')}>Plan the days</Link>
      </div>
    </section>
  )
}

// Only the organiser can move the whole group back one step. It deletes the data of the step, so it asks first.
function BackStep({ plan, state }: StepProps) {
  const [open, setOpen] = useState(false)
  const step = backStep(state)
  if (!step) return null
  return (
    <div className="border-t border-line pt-3">
      <Button variant="link" onClick={() => setOpen(true)} className="text-muted">Go back a step</Button>
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
