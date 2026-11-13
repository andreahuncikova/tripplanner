import { useMemo, useState } from 'react'
import type { DateRange } from '@shared/types'
import { cn } from '../../../lib/cn'
import {
  addDays, dayKey, dayLabel, daysIn, fits, leadingRange, monthGrid, monthName, names, rangeText, votesText, windowMonths,
} from '../../../lib/plan'
import { Button, ConfirmModal } from '../../../components/ui'
import { StepCard } from './StepGuide'
import type { StepProps } from './step'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
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
    <section aria-label="Dates" className="flex flex-col gap-4">
      {/* Marking days and voting are two phases on the server, but one step for the group, so the card says what to do in each */}
      <StepCard
        step={2}
        title={state.phase === 'date_vote' ? 'Vote for your dates' : "Mark the days you can't travel"}
        aside={
          <Button variant={imDone ? 'soft' : 'secondary'} aria-pressed={imDone} onClick={() => plan.setDone(!imDone)} className="shrink-0 border-0">
            {imDone && <span aria-hidden="true">✓</span>}I'm done
          </Button>
        }
      >
        {state.phase === 'date_vote'
          ? `Everyone is free in the windows below. Vote for one, and ${isOrganiser ? 'you confirm' : `${organiser} confirms`} the dates. You can still change your days.`
          : `Then press I'm done. ${isOrganiser ? 'You find' : `${organiser} finds`} the windows when everyone is free.`}
      </StepCard>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4.5">
        <Calendar {...props} />
        <div className="flex flex-col gap-3 lg:flex-[1_1_280px]">
          <FreeWindows {...props} />
          <section aria-label="Who is done" className="flex flex-col gap-1.5 rounded-[14px] bg-white p-3.5 text-sm">
            <h3 className="font-extrabold">{done.length} of {state.members.length} done</h3>
            {done.length > 0 && <p className="text-subtle">Done: {names(done)}</p>}
            {waiting.length > 0 && <p className="text-chemin-dark">Waiting for: {names(waiting)}</p>}
          </section>
        </div>
      </div>
    </section>
  )
}

// The trip's months, one at a time. Tapping a day marks or unmarks it as a day the user cannot travel;
// the colours show the whole group: you can't, someone else can't, or everyone is free.
function Calendar({ plan, state, me }: StepProps) {
  const months = useMemo(() => windowMonths(state.tripWindowStart!, state.tripWindowEnd!), [state.tripWindowStart, state.tripWindowEnd])
  const [index, setIndex] = useState(0)
  const month = months[Math.min(index, months.length - 1)]
  const today = dayKey(new Date())

  const mine = useMemo(() => new Set(state.availability.find(a => a.userId === me)?.unavailableDates ?? []), [state.availability, me])
  // Day → names of the other members who cannot travel then (members only: someone who left does not count)
  const others = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const a of state.availability) {
      if (a.userId === me || !state.members.some(m => m.userId === a.userId)) continue
      for (const d of a.unavailableDates) map.set(d, [...(map.get(d) ?? []), a.username])
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
    <div className="flex flex-col gap-2 rounded-lg bg-white p-3 pb-3.5 lg:flex-[1_1_380px] lg:gap-2.5 lg:rounded-[18px] lg:p-4">
      <div className="flex items-center gap-1">
        <strong className="flex-1 px-1">{monthName.format(new Date(month + '-15T12:00:00'))}</strong>
        {months.length > 1 && (
          <>
            <MonthButton label="Previous month" disabled={index === 0} onClick={() => setIndex(i => i - 1)} path="M15 18l-6-6 6-6" />
            <MonthButton label="Next month" disabled={index >= months.length - 1} onClick={() => setIndex(i => i + 1)} path="M9 18l6-6-6-6" />
          </>
        )}
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-2xs font-bold text-muted lg:text-xs">
        {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid(month).map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />
          const past = day < today
          const busy = others.get(day)
          const status = mine.has(day) ? 'you can\'t travel' : busy ? `${names(busy.map(username => ({ username })))} can't travel` : 'everyone is free'
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              aria-pressed={mine.has(day)}
              aria-label={`${dayLabel(day)}, ${past ? 'in the past' : status}`}
              title={busy?.length ? `${names(busy.map(username => ({ username })))} can't travel` : undefined}
              disabled={past}
              onClick={() => toggle(day)}
              className={cn(
                'h-9.5 rounded-[10px] text-sm font-semibold lg:h-10',
                past ? 'text-faint' : mine.has(day) ? 'bg-roche text-white' : busy ? 'bg-[#d5dde5] text-subtle' : 'bg-[#d3eef2] text-roche hover:ring-2 hover:ring-sommet/40',
              )}
            >
              {Number(day.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 px-1 pt-1 text-xs text-subtle lg:gap-3.5">
        <Legend className="bg-roche">You can't</Legend>
        <Legend className="bg-[#d5dde5]">Someone can't</Legend>
        <Legend className="bg-[#d3eef2]">Everyone free</Legend>
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

function Legend({ className, children }: { className: string; children: string }) {
  return <span className="flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-3 rounded-[4px]', className)} />{children}</span>
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
    <section aria-labelledby="free-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="free-title" className="font-extrabold">Free for everyone</h3>
        {isOrganiser ? (
          <label className="flex items-center gap-1.5 text-caption text-subtle">
            Trip length
            <select
              value={tripDays ?? ''}
              onChange={e => plan.setLength(Number(e.target.value))}
              className="rounded-sm border border-line-strong bg-white px-2 py-1.25 font-bold text-roche"
            >
              {!tripDays && <option value="" disabled>Choose</option>}
              {LENGTHS.map(n => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
            </select>
          </label>
        ) : tripDays && <span className="text-caption text-subtle">Trip length: <strong>{tripDays} days</strong></span>}
      </div>

      {state.phase === 'calendar' ? (
        <div className="flex flex-col gap-3 rounded-[14px] bg-white p-3.5 text-sm text-subtle">
          {isOrganiser ? (
            <>
              <p>When everyone is done, look for the days when all of you are free.</p>
              <Button onClick={findFreeDates}>Find free dates</Button>
            </>
          ) : <p>{organiser} looks for the days when all of you are free, once everyone is done.</p>}
        </div>
      ) : (
        <>
          {state.dateRanges.map((r, i) => (
            <WindowRow key={`${r.start}-${r.end}`} range={r} mine={r.voterIds.includes(me)} tripDays={tripDays} onVote={() => plan.voteRange(i)} />
          ))}
          {!state.dateRanges.length && (
            <p className="rounded-[14px] bg-white p-3.5 text-sm text-subtle">
              There is no window when everyone is free{tripDays ? ` for ${tripDays} days` : ''}. Change your days{isOrganiser ? ', or choose a shorter trip and look again' : ''}.
            </p>
          )}
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
    <div className={cn('flex items-center gap-2.5 rounded-[14px] bg-white', mine ? 'border-2 border-sommet px-[12px] py-[10px]' : 'px-3.5 py-3', !ok && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <strong>{rangeText(r.start, r.end)}</strong>
        <span className="text-caption text-muted">{ok ? `${length} ${length === 1 ? 'day' : 'days'} · ${votesText(r.voterIds.length)}` : `Too short for ${tripDays} days`}</span>
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

  if (!isOrganiser) return <p className="rounded-lg bg-white p-4 text-sm text-subtle">{organiser} chooses the months the trip could happen in first.</p>
  return (
    <section aria-labelledby="months-title" className="flex flex-col gap-3 rounded-lg bg-white p-4">
      <h2 id="months-title" className="text-lg font-extrabold">Which months could work?</h2>
      <div className="flex gap-2.5">
        {[{ label: 'From', value: from, set: setFrom, list: options }, { label: 'To', value: to, set: setTo, list: options.filter(o => o.value >= from) }].map(f => (
          <label key={f.label} className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-subtle">
            {f.label}
            <select value={f.value} onChange={e => f.set(e.target.value)} className="rounded-[10px] border border-line-strong bg-white p-3 text-md font-normal text-roche">
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
