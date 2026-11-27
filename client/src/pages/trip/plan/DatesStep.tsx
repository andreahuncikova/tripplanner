import { useMemo, useState, type ReactNode } from 'react'
import type { DateRange } from '@shared/types'
import { cn } from '../../../lib/cn'
import {
  addDays, dayKey, dayLabel, daysIn, fits, leadingRange, monthGrid, monthName, names, rangeText, votesText, windowMonths,
} from '../../../lib/plan'
import { Avatar, Button, ConfirmModal } from '../../../components/ui'
import { StepCard } from './StepGuide'
import type { StepProps } from './step'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// The longest trip the organiser can set with + (the server allows up to 90 days)
const MAX_DAYS = 30

// Step 2 from the mockups. In the old app these were two phases on separate screens: first everyone marked days,
// then the organiser computed the free windows and the group voted. Now the calendar and the windows are side by side,
// and the calendar shows at once which days are free for everyone. The phases on the server stay the same.
export default function DatesStep(props: StepProps) {
  const { plan, state, me, isOrganiser, organiser } = props
  const done = state.members.filter(m => state.readyUserIds.includes(m.userId))
  // While voting, the avatars show who has voted for a window instead of who is done marking days
  const voting = state.phase === 'date_vote'
  const counted = voting ? state.members.filter(m => state.dateRanges.some(r => r.voterIds.includes(m.userId))) : done
  const notYet = state.members.filter(m => !counted.includes(m))
  const imDone = state.readyUserIds.includes(me)

  // Old trips may have no months yet; the organiser chooses them first
  if (!state.tripWindowStart || !state.tripWindowEnd) return <ChooseMonths {...props} />

  return (
    <section aria-label="Dates" className="flex flex-1 flex-col gap-4 lg:min-h-0">
      {/* Two steps in one view: Availability (everyone marks the days they can't travel) and Dates (the vote) */}
      <StepCard
        step={state.phase === 'date_vote' ? 3 : 2}
        back={props.back}
        agreed={[state.approvedDest, 'Everyone is done']}
        title={state.phase === 'date_vote' ? 'Vote for your dates' : "Mark the days you can't travel"}
        // "I'm done" belongs to marking the days (step 2); while voting (step 3) it is gone
        aside={voting ? undefined : (
          // A pill: plain glass with an empty circle while you are marking, filled green with a tick once you are done,
          // which a tap takes back
          <button
            type="button"
            aria-pressed={imDone}
            onClick={() => plan.setDone(!imDone)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full py-2 pr-4.5 pl-3.5 text-sm font-bold transition-colors',
              imDone ? 'bg-success text-white hover:bg-success/90' : 'bg-white/10 text-white ring-1 ring-white/30 ring-inset hover:bg-white/20',
            )}
          >
            <span aria-hidden="true" className={cn('flex size-5 items-center justify-center rounded-full', imDone ? 'bg-white text-success' : 'ring-2 ring-white/50 ring-inset [&>svg]:hidden')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            I'm done
          </button>
        )}
      >
        {state.phase === 'date_vote'
          ? `Vote for one window. ${isOrganiser ? 'You confirm' : `${organiser} confirms`} the dates.`
          : `Then press I'm done.`}
      </StepCard>

      {/* The same layout as the Itinerary: the calendar on the left, the free windows on the right (on phones below).
          On a computer both fill the rest of the window (at least the height of the calendar), and the free windows
          scroll when there are more than fit: the right column takes no height of its own (h-0) and fills the row. */}
      <div className="flex flex-col gap-8 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Calendar {...props} />
        {/* One white card, as high as the calendar: the free windows, and under a line who is done and the buttons */}
        <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card lg:h-0 lg:min-h-full lg:p-5">
          <FreeWindows {...props} whoDone={
          // One row: everyone's avatar (a green tick on those who are done, faded for the others), then the count
          <section aria-label="Who is done" className="flex min-w-0 items-center gap-2.5">
            <ul className="flex shrink-0 -space-x-1.5">
              {state.members.map(m => {
                const ready = counted.includes(m)
                return (
                  <li key={m.userId} title={`${m.username}${ready ? ', done' : ', not done yet'}`} className={cn('relative rounded-full ring-2 ring-white', !ready && 'opacity-40')}>
                    <Avatar name={m.username} color={m.color} photo={m.photo} size="sm" />
                    {ready && (
                      <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-success text-[9px] font-extrabold text-white ring-2 ring-white">✓</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex min-w-0 flex-col text-sm leading-tight">
              <h3 className="font-extrabold">{counted.length} of {state.members.length} {voting ? 'voted' : 'done'}</h3>
              {notYet.length > 0 && <span className="truncate text-xs text-muted">Waiting for: {names(notYet)}</span>}
            </div>
          </section>
          } />
        </div>
      </div>
    </section>
  )
}

// The trip's months, one at a time, drawn like the calendar in the Itinerary but smaller. Tapping a day marks or
// unmarks it as a day the user cannot travel. The days show the whole group, the way the Itinerary shows the days
// of the trip: everyone is free (a dark number under a blue line), someone else can't (greyed out, with a dot in the
// colour of each of them), or you can't (filled dark).
function Calendar({ plan, state, me }: StepProps) {
  const months = useMemo(() => windowMonths(state.tripWindowStart!, state.tripWindowEnd!), [state.tripWindowStart, state.tripWindowEnd])
  const [index, setIndex] = useState(0)
  const month = months[Math.min(index, months.length - 1)]
  const today = dayKey(new Date())

  const mine = useMemo(() => new Set(state.availability.find(a => a.userId === me)?.unavailableDates ?? []), [state.availability, me])
  // Day → the other members who cannot travel then (members only: someone who left does not count)
  const others = useMemo(() => {
    const map = new Map<string, { username: string; color: string }[]>()
    for (const a of state.availability) {
      if (a.userId === me || !state.members.some(m => m.userId === a.userId)) continue
      for (const d of a.unavailableDates) map.set(d, [...(map.get(d) ?? []), { username: a.username, color: a.color }])
    }
    return map
  }, [state.availability, state.members, me])

  function toggle(day: string) {
    const next = new Set(mine)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    plan.setUnavailable([...next].sort())
  }

  return (
    // A white card like a calendar in any app: a rounded tile for each day
    <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-white p-4 shadow-card lg:min-h-0 lg:p-5">
      <div className="flex items-center gap-1">
        <p className="flex-1 text-lg font-extrabold">{monthName.format(new Date(month + '-15T12:00:00'))}</p>
        {months.length > 1 && (
          <>
            <MonthButton label="Previous month" disabled={index === 0} onClick={() => setIndex(i => i - 1)} path="M15 18l-6-6 6-6" />
            <MonthButton label="Next month" disabled={index >= months.length - 1} onClick={() => setIndex(i => i + 1)} path="M9 18l6-6-6-6" />
          </>
        )}
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map(d => <span key={d} className="text-center text-2xs font-bold tracking-wider text-muted uppercase">{d}</span>)}
      </div>
      {/* On a computer the tiles share the height that is left, so the step always fits in the window without scrolling */}
      <div role="group" aria-label="Days of the month" className="grid grid-cols-7 gap-1.5 lg:min-h-0 lg:flex-1 lg:auto-rows-[minmax(0,3.25rem)] lg:content-start">
        {monthGrid(month).map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />
          const past = day < today
          const busy = others.get(day)
          const who = busy && names(busy)
          const status = mine.has(day) ? 'you can\'t travel' : busy ? `${who} can't travel` : 'everyone is free'
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              aria-pressed={mine.has(day)}
              aria-label={`${dayLabel(day)}, ${past ? 'in the past' : status}`}
              title={who ? `${who} can't travel` : undefined}
              disabled={past}
              onClick={() => toggle(day)}
              className={cn(
                'relative flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md text-center transition-colors lg:h-auto',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sommet',
                past ? 'text-faint/60'
                : mine.has(day) ? 'bg-roche text-white'
                : busy ? 'bg-chemin-light text-chemin-dark hover:bg-chemin-line/60'
                : 'bg-canvas text-roche hover:bg-ciel-light',
                day === today && 'ring-2 ring-sommet ring-inset',
              )}
            >
              <span className="text-sm font-bold">{Number(day.slice(8))}</span>
              {/* A dot in the colour of each other member who can't travel that day */}
              {busy && !past && (
                <span aria-hidden="true" className="flex gap-0.5">
                  {busy.slice(0, 4).map(b => <span key={b.username} className="size-1 rounded-full" style={{ backgroundColor: b.color }} />)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-line pt-3 text-xs text-subtle lg:gap-4">
        <Legend sample={<span className="size-3.5 rounded-[4px] bg-roche" />}>You can't</Legend>
        <Legend sample={<span className="size-3.5 rounded-[4px] bg-chemin-light ring-1 ring-chemin-line ring-inset" />}>Someone can't</Legend>
        <Legend sample={<span className="size-3.5 rounded-[4px] bg-canvas ring-1 ring-line-strong ring-inset" />}>Everyone free</Legend>
      </div>
    </div>
  )
}

// A round − or + next to the trip length
function StepButton({ label, disabled, onClick, path }: { label: string; disabled: boolean; onClick: () => void; path: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex size-7 items-center justify-center rounded-full bg-white text-roche shadow-card hover:bg-ciel-light disabled:opacity-40">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d={path} /></svg>
    </button>
  )
}

function MonthButton({ label, disabled, onClick, path }: { label: string; disabled: boolean; onClick: () => void; path: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex size-9 items-center justify-center rounded-md text-subtle hover:bg-canvas disabled:opacity-35">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
    </button>
  )
}

// A small sample of how the calendar shows a kind of day, and its name
function Legend({ sample, children }: { sample: ReactNode; children: string }) {
  return <span className="flex items-center gap-1.5"><span aria-hidden="true" className="flex">{sample}</span>{children}</span>
}

// "Free for everyone": the windows the organiser found, the trip length and the votes
// `whoDone` (the avatars) and the organiser's buttons sit at the bottom of the card, under a line.
function FreeWindows({ plan, state, me, isOrganiser, organiser, whoDone }: StepProps & { whoDone: ReactNode }) {
  const [confirming, setConfirming] = useState<number | null>(null)
  const [asking, setAsking] = useState(false)
  const tripDays = state.tripDuration
  const top = leadingRange(state.dateRanges, tripDays)
  // Someone who has not marked anything looks free on every day, so the organiser is asked first
  // while anyone has not pressed "I'm done" yet
  const waiting = state.members.filter(m => !state.readyUserIds.includes(m.userId))
  const findFreeDates = () => (waiting.length ? setAsking(true) : plan.findFreeDates())

  return (
    <section aria-labelledby="free-title" className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      {/* The title, and on the right of it the trip length: − and + for the organiser, the number for the others */}
      <div className="flex items-center justify-between gap-2">
        <h3 id="free-title" className="font-extrabold">Free for everyone</h3>
        {isOrganiser ? (
          <div role="group" aria-label="Trip length" title="Trip length" className="flex items-center gap-1 rounded-full bg-canvas p-1 text-sm">
            <StepButton label="Shorter trip" disabled={!tripDays || tripDays <= 1} onClick={() => plan.setLength((tripDays ?? 2) - 1)} path="M5 12h14" />
            <span aria-live="polite" className="min-w-14 text-center font-bold">{tripDays ? `${tripDays} ${tripDays === 1 ? 'day' : 'days'}` : 'Length'}</span>
            <StepButton label="Longer trip" disabled={!!tripDays && tripDays >= MAX_DAYS} onClick={() => plan.setLength((tripDays ?? 0) + 1)} path="M12 5v14M5 12h14" />
          </div>
        ) : <span className="text-sm text-muted"><span className="sr-only">Trip length: </span><strong className="text-roche">{tripDays ? `${tripDays} ${tripDays === 1 ? 'day' : 'days'}` : 'Length not chosen'}</strong></span>}
      </div>

      {state.phase === 'calendar' ? (
        // Until the windows are found: a picture of what comes here
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-ciel-light text-sommet">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>
          </span>
          <p className="text-sm text-muted">{isOrganiser ? 'Free windows show up here.' : `Free windows show up here when ${organiser} looks for them.`}</p>
        </div>
      ) : (
        <>
          <div aria-label="Free windows" role="group" className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:[&>*]:shrink-0">
            {state.dateRanges.map((r, i) => (
              <WindowRow key={`${r.start}-${r.end}`} range={r} mine={r.voterIds.includes(me)} tripDays={tripDays} onVote={() => plan.voteRange(i)} />
            ))}
            {!state.dateRanges.length && (
              <p className="rounded-md bg-canvas p-3.5 text-sm text-subtle">
                There is no window when everyone is free{tripDays ? ` for ${tripDays} days` : ''}. Change your days{isOrganiser ? ', or choose a shorter trip and look again' : ''}.
              </p>
            )}
          </div>
        </>
      )}

      {/* Under the line. Marking days: who is done on the left, Find free dates on the right.
          Voting: who has voted, and under it the organiser's two buttons, always both, so nothing moves when the
          first vote comes in (Confirm waits, greyed out, until a window has a vote). */}
      {state.phase === 'calendar' ? (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0 flex-1">{whoDone}</div>
          {isOrganiser && <Button size="sm" onClick={findFreeDates} className="shrink-0">Find free dates</Button>}
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
          {whoDone}
          {isOrganiser && (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button variant="secondary" size="sm" onClick={findFreeDates}>Find again</Button>
              <Button size="sm" disabled={top < 0} onClick={() => setConfirming(top)} className="min-w-0">
                <span className="truncate">{top >= 0 ? `Confirm ${rangeText(state.dateRanges[top].start, state.dateRanges[top].end)}` : 'Confirm dates'}</span>
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={asking}
        onClose={() => setAsking(false)}
        title="Find free dates now?"
        text={`${names(waiting)} ${waiting.length === 1 ? "hasn't" : "haven't"} pressed I'm done yet. Until they mark their days, they count as free on every day, so the dates may not work for them.`}
        confirm="Find free dates"
        tone="primary"
        onConfirm={() => { plan.findFreeDates(); setAsking(false) }}
      />

      {confirming !== null && state.dateRanges[confirming] && (
        <ConfirmDates
          range={state.dateRanges[confirming]}
          tripDays={tripDays}
          onClose={() => setConfirming(null)}
          onConfirm={start => { plan.confirmRange(confirming, start); setConfirming(null) }}
        />
      )}
    </section>
  )
}

function WindowRow({ range: r, mine, tripDays, onVote }: { range: DateRange; mine: boolean; tripDays: number | null; onVote: () => void }) {
  const ok = fits(r, tripDays)
  const length = daysIn(r.start, r.end)
  return (
    <div className={cn('flex items-center gap-2.5 rounded-md py-2 pr-2 pl-3', mine ? 'bg-ciel-light' : 'bg-canvas', !ok && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-sm">{rangeText(r.start, r.end)}</strong>
        <span className="text-xs text-muted">{ok ? `${length} ${length === 1 ? 'day' : 'days'} · ${votesText(r.voterIds.length)}` : `Too short for ${tripDays} days`}</span>
      </div>
      {ok && (
        <Button size="sm" variant={mine ? 'primary' : 'secondary'} aria-pressed={mine} onClick={onVote} aria-label={`${mine ? 'Your vote' : 'Vote for'} ${rangeText(r.start, r.end)}`} className="min-h-8 shrink-0 px-3 text-xs lg:min-h-8 lg:px-3">
          {mine ? 'Your vote' : 'Vote'}
        </Button>
      )}
    </div>
  )
}

// The organiser confirms the dates. A window longer than the trip lets them choose the first day.
function ConfirmDates({ range, tripDays, onClose, onConfirm }: {
  range: DateRange; tripDays: number | null; onClose: () => void; onConfirm: (start: string) => void
}) {
  const days = tripDays ?? daysIn(range.start, range.end)
  const starts = Array.from({ length: daysIn(range.start, range.end) - days + 1 }, (_, i) => addDays(range.start, i))
  const [start, setStart] = useState(starts[0])
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Confirm the trip dates?"
      text={starts.length > 1
        ? `Everyone is free from ${rangeText(range.start, range.end)}. Choose when the ${days}-day trip starts.`
        : `The trip will be ${rangeText(start, addDays(start, days - 1))}. After this the group plans stays and activities.`}
      confirm="Confirm dates"
      tone="primary"
      onConfirm={() => onConfirm(start)}
    >
      {starts.length > 1 && (
        <div className="flex flex-col gap-2">
          <label htmlFor="trip-start" className="text-sm font-bold">Trip dates</label>
          <select id="trip-start" value={start} onChange={e => setStart(e.target.value)} className="select rounded-md border border-line-strong bg-white py-3 pl-3.5 text-base text-roche">
            {starts.map(s => <option key={s} value={s}>{rangeText(s, addDays(s, days - 1))}</option>)}
          </select>
        </div>
      )}
    </ConfirmModal>
  )
}

// Trips from the old app can start without months. The organiser chooses them, as on the New trip screen.
function ChooseMonths({ plan, isOrganiser, organiser }: StepProps) {
  const options = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i)
    return { value: dayKey(d).slice(0, 7), label: monthName.format(d) }
  }), [])
  const [from, setFrom] = useState(options[1].value)
  const [to, setTo] = useState(options[2].value)

  if (!isOrganiser) return <p className="rounded-lg bg-white p-4 shadow-card text-sm text-subtle">{organiser} chooses the months the trip could happen in first.</p>
  return (
    <section aria-labelledby="months-title" className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-card">
      <h2 id="months-title" className="text-lg font-extrabold">Which months could work?</h2>
      <div className="flex gap-2.5">
        {[{ label: 'From', value: from, set: setFrom, list: options }, { label: 'To', value: to, set: setTo, list: options.filter(o => o.value >= from) }].map(f => (
          <label key={f.label} className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-subtle">
            {f.label}
            <select value={f.value} onChange={e => f.set(e.target.value)} className="select rounded-md border border-line-strong bg-white py-2.5 pl-3 text-sm font-normal text-roche">
              {f.list.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      {/* The server moves the end to the real last day of that month */}
      <Button onClick={() => plan.setWindow(`${from}-01`, `${to < from ? from : to}-28`)}>Save months</Button>
    </section>
  )
}
