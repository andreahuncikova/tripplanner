import { useState, type FormEvent } from 'react'
import type { Destination, Member } from '@shared/types'
import { cn } from '../../../lib/cn'
import { leadingDestination, names, votesText } from '../../../lib/plan'
import { Avatar, Button } from '../../../components/ui'
import { CloseIcon, PlusIcon } from '../../../components/layout/icons'
import { StepCard } from './StepGuide'
import type { StepProps } from './step'

// Step 1 from the mockups: members suggest places and each has one vote, which they can move or take back.
// The organiser confirms the place with the most votes.
export default function DestinationStep({ plan, state, me, isOrganiser, organiser, back }: StepProps) {
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
    <section aria-label="Destination" className="flex flex-1 flex-col gap-4 lg:min-h-0 lg:gap-5.5">
      <StepCard
        step={1}
        back={back}
        title="Where should we go?"
        aside={<span className="hidden shrink-0 text-sm text-white/85 lg:inline">{voted.length} of {state.members.length} voted</span>}
      >
        Suggest places and vote. {isOrganiser ? 'You confirm' : `${organiser} confirms`} the winner.
      </StepCard>

      {/* On a computer the list takes the free height and scrolls when there are many places; the vote count stays at the bottom */}
      <div role="group" aria-label="Destinations" className="flex flex-1 flex-col gap-2.5 lg:min-h-0">
        <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto lg:[&>*]:shrink-0">
        {state.destinations.map(d => (
          <DestinationRow
            key={d._id}
            destination={d}
            by={state.members.find(m => m.userId === d.byUserId)}
            mine={d.voterIds.includes(me)}
            canRemove={d.byUserId === me || isOrganiser}
            onVote={() => plan.vote(d._id)}
            onRemove={() => plan.removeDestination(d._id)}
          />
        ))}
        </div>

        {/* The same field as "Paste a stay link" on the Stays tab */}
        <form onSubmit={suggest} className="flex items-center gap-2 rounded-md bg-white py-1 pr-1 pl-3.5 shadow-card focus-within:ring-1 focus-within:ring-sommet">
          <span aria-hidden="true" className="flex text-faint"><PlusIcon /></span>
          <label htmlFor="suggest-place" className="sr-only">Suggest a place</label>
          <input
            id="suggest-place"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            maxLength={60}
            autoComplete="off"
            placeholder="Suggest another place"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-roche placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-8 shrink-0 rounded-sm bg-roche px-4 text-sm font-bold text-white hover:bg-roche-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </form>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </div>

      {/* At the very bottom of the window; lg:pr-20 leaves room for the round chat button in the bottom right corner */}
      <div className="flex flex-col gap-3.5 border-t border-line pt-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:pr-20">
        <div className="flex items-center gap-2.5">
          <VoterDots members={state.members} voted={voted} />
          <span className="text-sm text-subtle">
            {voted.length} of {state.members.length} voted{waiting.length > 0 && ` · waiting for ${names(waiting)}`}
          </span>
        </div>
        {isOrganiser && top && (
          <Button size="lg" onClick={() => plan.approve(top._id)} className="rounded-[14px] lg:rounded-md">
            Confirm {placeName(top.name)} as destination
          </Button>
        )}
      </div>
    </section>
  )
}

// "bali" → "Bali": shown with a capital letter, whatever was typed (the saved name stays as it is)
const placeName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

// A white card without a shadow: the list scrolls on a computer and would cut a shadow off. Your vote is the blue tick.
// One line: the name, who suggested it (their avatar and first name), and the votes on the right.
function DestinationRow({ destination: d, by, mine, canRemove, onVote, onRemove }: {
  destination: Destination; by?: Member; mine: boolean; canRemove: boolean; onVote: () => void; onRemove: () => void
}) {
  const votes = d.voterIds.length
  return (
    <div className="relative flex items-center overflow-hidden rounded-lg bg-white">
      <button
        type="button"
        aria-pressed={mine}
        onClick={onVote}
        className={cn('relative flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left', canRemove ? 'pr-2' : 'pr-4')}
      >
        <span aria-hidden="true" className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold', mine ? 'bg-sommet text-white' : 'border-2 border-faint')}>
          {mine && '✓'}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <strong className="truncate">{placeName(d.name)}</strong>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <span aria-hidden="true" className="flex"><Avatar name={d.by} color={by?.color ?? '#8a96a6'} photo={by?.photo} size="xs" /></span>
            <span className="sr-only">Suggested by </span>{d.by.split(' ')[0]}
          </span>
        </span>
        {/* Phones show only the number, as in the mockups; screen readers always hear "3 votes" */}
        <span className="text-sm font-bold">
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
