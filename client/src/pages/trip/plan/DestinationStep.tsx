import { useState, type FormEvent } from 'react'
import type { Destination, Member } from '@shared/types'
import { cn } from '../../../lib/cn'
import { leadingDestination, names, votesText } from '../../../lib/plan'
import { Button } from '../../../components/ui'
import { CloseIcon } from '../../../components/layout/icons'
import { StepCard } from './StepGuide'
import type { StepProps } from './step'

// Step 1 from the mockups: members suggest places and each has one vote, which they can move or take back.
// The organiser confirms the place with the most votes. The bar behind each place shows its share of the group.
export default function DestinationStep({ plan, state, me, isOrganiser, organiser }: StepProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const voted = state.members.filter(m => state.destinations.some(d => d.voterIds.includes(m.userId)))
  const waiting = state.members.filter(m => !voted.includes(m))
  const top = leadingDestination(state.destinations, state.adminUserId)

  function suggest(e: FormEvent) {
    e.preventDefault()
    const place = name.trim()
    if (!place) return
    // The server does not add the same place twice either, because it would split the votes
    if (state.destinations.some(d => d.name.toLowerCase() === place.toLowerCase())) {
      setError(`${place} is already on the list. Vote for it instead.`)
      return
    }
    plan.suggest(place)
    setName('')
    setError('')
  }

  return (
    <section aria-label="Destination" className="flex flex-col gap-4 lg:gap-5.5">
      <StepCard
        step={1}
        title="Where should we go?"
        aside={<span className="hidden shrink-0 text-sm text-[#d5dde5] lg:inline">{voted.length} of {state.members.length} voted</span>}
      >
        Suggest places and pick one favourite. {isOrganiser ? 'As organiser, you confirm' : `${organiser} confirms`} the winner once everyone has voted.
      </StepCard>

      <div role="group" aria-label="Destinations" className="flex flex-col gap-2.5">
        {state.destinations.map(d => (
          <DestinationRow
            key={d._id}
            destination={d}
            mine={d.voterIds.includes(me)}
            canRemove={d.byUserId === me || isOrganiser}
            groupSize={state.members.length}
            onVote={() => plan.vote(d._id)}
            onRemove={() => plan.removeDestination(d._id)}
          />
        ))}
        {!state.destinations.length && <p className="rounded-lg bg-white p-4 text-sm text-muted">No places yet. Suggest the first one.</p>}

        <form onSubmit={suggest} className="flex gap-2 rounded-lg border border-dashed border-line-strong bg-white p-1.5 lg:gap-2.5 lg:p-2.5">
          <label htmlFor="suggest-place" className="sr-only">Suggest a place</label>
          <input
            id="suggest-place"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            maxLength={60}
            autoComplete="off"
            placeholder="+ Suggest another place"
            className="min-w-0 flex-1 rounded-md px-3 py-3 text-md placeholder:text-muted focus:outline-none"
          />
          <Button type="submit" variant="dark" disabled={!name.trim()}>Add</Button>
        </form>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-3.5 border-t border-line pt-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5">
          <VoterDots members={state.members} voted={voted} />
          <span className="text-sm text-subtle">
            {voted.length} of {state.members.length} voted{waiting.length > 0 && ` · waiting for ${names(waiting)}`}
          </span>
        </div>
        {isOrganiser && top && (
          <Button size="lg" onClick={() => plan.approve(top._id)} className="rounded-[14px] lg:rounded-md">
            Confirm {top.name} as destination
          </Button>
        )}
      </div>
    </section>
  )
}

function DestinationRow({ destination: d, mine, canRemove, groupSize, onVote, onRemove }: {
  destination: Destination; mine: boolean; canRemove: boolean; groupSize: number; onVote: () => void; onRemove: () => void
}) {
  const votes = d.voterIds.length
  return (
    <div className={cn(
      'relative flex items-center overflow-hidden rounded-[14px] bg-white lg:rounded-lg',
      // 2 px border on your vote; the padding below makes up the difference, so the row does not jump
      mine ? 'border-2 border-sommet' : 'border border-[#e3e8ee]',
    )}>
      <span aria-hidden="true" style={{ width: `${groupSize ? (votes / groupSize) * 100 : 0}%` }} className={cn('absolute inset-y-0 left-0 transition-[width] duration-300', mine ? 'bg-ciel-light' : 'bg-canvas')} />
      <button
        type="button"
        aria-pressed={mine}
        onClick={onVote}
        className={cn('relative flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 text-left lg:min-h-18 lg:gap-4', mine ? 'pl-[15px] lg:pl-[21px]' : 'pl-4 lg:pl-5.5', canRemove ? 'pr-2' : mine ? 'pr-[15px] lg:pr-[21px]' : 'pr-4 lg:pr-5.5')}
      >
        <span aria-hidden="true" className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold', mine ? 'bg-sommet text-white' : 'border-2 border-faint')}>
          {mine && '✓'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="truncate lg:text-[17px]">{d.name}</strong>
          <span className="text-caption text-muted">Suggested by {d.by}</span>
        </span>
        {/* Phones show only the number, as in the mockups; screen readers always hear "3 votes" */}
        <span className="text-sm font-extrabold lg:text-[15px]">
          <span className="lg:hidden" aria-hidden="true">{votes}</span>
          <span className="sr-only lg:not-sr-only">{votesText(votes)}</span>
        </span>
      </button>
      {canRemove && (
        <button type="button" aria-label={`Remove ${d.name}`} onClick={onRemove} className="relative mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:text-danger">
          <CloseIcon />
        </button>
      )}
    </div>
  )
}

// The group's avatars: full for those who voted, dashed for those who have not yet
function VoterDots({ members, voted }: { members: Member[]; voted: Member[] }) {
  return (
    <span aria-hidden="true" className="flex">
      {members.slice(0, 6).map((m, i) => (
        <span
          key={m.userId}
          style={voted.includes(m) ? { backgroundColor: m.color } : undefined}
          className={cn(
            'flex size-6.5 items-center justify-center rounded-full border-2 text-[10px] font-bold lg:size-7.5 lg:text-[11px]',
            voted.includes(m) ? 'border-canvas text-white lg:border-white' : 'border-dashed border-line-strong bg-white text-muted',
            i > 0 && '-ml-1.75 lg:-ml-2',
          )}
        >
          {m.username.charAt(0).toUpperCase()}
        </span>
      ))}
    </span>
  )
}
