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
// Trip lengths the organiser can choose (the server allows up to 90 days)
const LENGTHS = Array.from({ length: 30 }, (_, i) => i + 1)

// Step 2 from the mockups. In the old app these were two phases on separate screens: first everyone marked days,
// then the organiser computed the free windows and the group voted. Now the calendar and the windows are side by side,
// and the calendar shows at once which days are free for everyone. The phases on the server stay the same.
export default function DatesStep(props: StepProps) {
  const { plan, state, me, isOrganiser, organiser } = props
  const done = state.members.filter(m => state.readyUserIds.includes(m.userId))
  const waiting = state.members.filter(m => !done.includes(m))
  const imDone = state.readyUserIds.includes(me)

  // Old trips may have no months yet; the organiser chooses them first
  if (!state.tripWindowStart || !state.tripWindowEnd) return <ChooseMonths {...props} />

  return (
    <section aria-label="Dates" className="flex flex-1 flex-col gap-4 lg:min-h-0">
      {/* Marking days and voting are two phases on the server, but one step for the group, so the card says what to do in each */}
      <StepCard
        step={2}
        back={props.back}
        agreed={[state.approvedDest]}
        title={state.phase === 'date_vote' ? 'Vote for your dates' : "Mark the days you can't travel"}
        aside={
          <Button variant={imDone ? 'soft' : 'secondary'} aria-pressed={imDone} onClick={() => plan.setDone(!imDone)} className="shrink-0 border-0">
            {imDone && <span aria-hidden="true">✓</span>}I'm done
          </Button>
        }
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
        {/* One white card, as high as the calendar: the free windows, and under a line who is done */}
        <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card lg:h-0 lg:min-h-full lg:p-5">
          <FreeWindows {...props} />
          <section aria-label="Who is done" className="mt-auto flex flex-col gap-2.5 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <h3 className="font-extrabold">{done.length} of {state.members.length} done</h3>
              {waiting.length > 0 && <span className="truncate text-muted">Waiting for: {names(waiting)}</span>}
            </div>
            {/* Everyone's avatar: a green tick on those who are done, faded for those who are not yet */}
            <ul className="flex flex-wrap gap-2">
              {state.members.map(m => {
                const ready = done.includes(m)
                return (
                  <li key={m.userId} title={`${m.username}${ready ? ', done' : ', not done yet'}`} className={cn('relative', !ready && 'opacity-40')}>
                    <Avatar name={m.username} color={m.color} photo={m.photo} size="sm" />
                    {ready && (
                      <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-success text-[9px] font-extrabold text-white ring-2 ring-white">✓</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
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
function FreeWindows({ plan, state, me, isOrganiser, organiser }: StepProps) {
  const [confirming, setConfirming] = useState<number | null>(null)
  const [asking, setAsking] = useState(false)
  const tripDays = state.tripDuration
  const top = leadingRange(state.dateRanges, tripDays)
  // Someone who has not marked anything looks free on every day, so the organiser is asked first
  // while anyone has not pressed "I'm done" yet
  const waiting = state.members.filter(m => !state.readyUserIds.includes(m.userId))
  const findFreeDates = () => (waiting.length ? setAsking(true) : plan.findFreeDates())

  return (
    <section aria-labelledby="free-title" className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
      <div className="flex items-center justify-between gap-2">
        <h3 id="free-title" className="font-extrabold">Free for everyone</h3>
        {isOrganiser ? (
          <label className="flex items-center gap-1.5 text-sm text-subtle">
            Trip length
            <select
              value={tripDays ?? ''}
              onChange={e => plan.setLength(Number(e.target.value))}
              className="rounded-sm border border-line-strong bg-white px-2 py-1 font-bold text-roche"
            >
              {!tripDays && <option value="" disabled>Choose</option>}
              {LENGTHS.map(n => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
            </select>
          </label>
        ) : tripDays && <span className="text-sm text-subtle">Trip length: <strong>{tripDays} days</strong></span>}
      </div>

      {state.phase === 'calendar' ? (
        <div className="flex flex-col gap-3 text-sm text-subtle">
          {isOrganiser ? (
            <>
              <p>When everyone is done, look for the days when all of you are free.</p>
              <Button onClick={findFreeDates}>Find free dates</Button>
            </>
          ) : <p>{organiser} looks for the days when all of you are free, once everyone is done.</p>}
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
          {isOrganiser && (
            <div className="flex flex-col gap-2">
              {top >= 0 && <Button onClick={() => setConfirming(top)}>Confirm {rangeText(state.dateRanges[top].start, state.dateRanges[top].end)}</Button>}
              <Button variant="link" onClick={findFreeDates}>Find free dates again</Button>
            </div>
          )}
        </>
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
    <div className={cn('flex items-center gap-2.5 rounded-md px-3.5 py-2.5', mine ? 'bg-ciel-light' : 'bg-canvas', !ok && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <strong>{rangeText(r.start, r.end)}</strong>
        <span className="text-sm text-muted">{ok ? `${length} ${length === 1 ? 'day' : 'days'} · ${votesText(r.voterIds.length)}` : `Too short for ${tripDays} days`}</span>
      </div>
      {ok && (
        <Button size="sm" variant={mine ? 'primary' : 'secondary'} aria-pressed={mine} onClick={onVote} aria-label={`${mine ? 'Your vote' : 'Vote for'} ${rangeText(r.start, r.end)}`}>
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
          <select id="trip-start" value={start} onChange={e => setStart(e.target.value)} className="rounded-md border border-line-strong bg-white px-4 py-3.5 text-base text-roche">
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
            <select value={f.value} onChange={e => f.set(e.target.value)} className="rounded-[10px] border border-line-strong bg-white p-3 text-base font-normal text-roche">
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
