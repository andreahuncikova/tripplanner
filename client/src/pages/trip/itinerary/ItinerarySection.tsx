import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Activity, Stay } from '@shared/types'
import { nightsCover, type DayRange } from '@shared/nights'
import { useAuth } from '../../../auth/useAuth'
import { Button, Card, Input, Modal } from '../../../components/ui'
import { cn } from '../../../lib/cn'
import { addDays, dayLabel, fromKey } from '../../../lib/plan'
import type { TripPlan } from '../../../socket/useTripPlan'
import type { TripStays } from '../../../socket/useTripStays'
import { nightCount, nightsRange, nightsWord, platformName, shortDayText } from '../stayFormat'

// The Itinerary tab from the Itinerary mockup: the trip day by day. A strip of days on top (amber when the night
// has no booked stay), the stay for the selected night, then that day's activities in order of time.
// Activities without a day are ideas for later, listed at the end. It is the main view once the trip has dates.
export default function ItinerarySection({ plan, stays }: { plan: TripPlan; stays: TripStays }) {
  const { user } = useAuth()
  const state = plan.state
  const [picked, setPicked] = useState<string | null>(null)
  // null: closed; 'new': a new activity; or the activity being changed
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)

  if (!state) return <p className="text-muted">Loading the itinerary…</p>

  const trip = state.finalDate && state.tripDuration
    ? { start: state.finalDate, end: addDays(state.finalDate, state.tripDuration - 1) } : null
  const days = trip ? Array.from({ length: state.tripDuration! }, (_, i) => addDays(trip.start, i)) : []
  const cover = trip ? nightsCover(trip, stays.stays) : null
  const today = new Date().toISOString().slice(0, 10)
  const day = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0] ?? null
  const ideas = state.activities.filter(a => !a.calDate || !days.includes(a.calDate))
  const canChange = (a: Activity) => !!user && (a.userId === user._id || state.adminUserId === user._id)

  return (
    <section aria-labelledby="itinerary-title" className="mx-auto flex w-full max-w-180 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="itinerary-title" className="text-2xl font-extrabold">Itinerary</h2>
        <Button size="sm" onClick={() => setEditing('new')}>+ Add activity</Button>
      </div>

      {!trip ? (
        <Card className="flex flex-col items-start gap-2">
          <p className="font-bold">The days appear once the trip has dates.</p>
          <p className="text-muted">Until then, add ideas for things to do, and give them a day later.</p>
          <Link to="../plan" className="font-bold text-sommet hover:text-sommet-dark">Go to the dates</Link>
        </Card>
      ) : (
        <>
          <DayStrip days={days} day={day!} cover={cover!} onPick={setPicked} />
          <NightStay day={day!} trip={trip} stays={stays.stays} />
          <h3 className="text-lg font-extrabold">{dayLabel(day!)}</h3>
          <DayActivities
            activities={state.activities.filter(a => a.calDate === day)}
            canChange={canChange}
            onEdit={setEditing}
          />
          {cover!.gaps.length > 0 && (
            <p role="status" className="rounded-lg border border-chemin-line bg-chemin-light px-3.5 py-2.5 text-sm text-chemin-dark">
              <strong>No stay booked</strong> for {cover!.gaps.map(gapText).join(', ')}.{' '}
              <Link to="../stays" className="font-bold text-chemin-dark underline hover:no-underline">Choose a stay</Link>
            </p>
          )}
        </>
      )}

      {ideas.length > 0 && (
        <section aria-labelledby="ideas-title" className="flex flex-col gap-2">
          <h3 id="ideas-title" className="text-lg font-extrabold">Ideas without a day</h3>
          <ul className="flex flex-col gap-2">
            {ideas.map(a => <li key={a._id}><ActivityCard activity={a} canChange={canChange(a)} onEdit={() => setEditing(a)} /></li>)}
          </ul>
        </section>
      )}

      <ActivityModal
        key={editing === 'new' ? `new-${day}` : editing?._id ?? 'none'}
        editing={editing}
        days={days}
        defaultDay={day}
        plan={plan}
        onClose={() => setEditing(null)}
      />
    </section>
  )
}

// "13 – 15 Jun (2 nights)", as in the Stays tab
const gapText = (r: DayRange) => {
  const n = { checkIn: r.first, checkOut: addDays(r.last, 1) }
  return `${nightsRange(n)} (${nightsWord(nightCount(n))})`
}

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

function DayStrip({ days, day, cover, onPick }: {
  days: string[]; day: string; cover: ReturnType<typeof nightsCover>; onPick: (d: string) => void
}) {
  const last = days[days.length - 1]
  return (
    <div role="group" aria-label="Days of the trip" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
      {days.map(d => {
        // The last day has no night; every other day is amber when its night has no booked stay
        const noStay = d !== last && !cover.nights.find(n => n.day === d)?.stayIds.length
        const active = d === day
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            aria-label={`${dayLabel(d)}${noStay ? ', no stay booked for the night' : ''}`}
            onClick={() => onPick(d)}
            className={cn(
              'flex min-w-13 shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5',
              active ? 'border-roche bg-roche text-white'
                : noStay ? 'border-chemin-line bg-chemin-light text-chemin-dark hover:bg-chemin-light/70'
                : 'border-line bg-white text-roche hover:bg-canvas',
            )}
          >
            <span className="text-xs font-semibold">{weekday.format(fromKey(d))}</span>
            <span className="text-lg font-extrabold">{fromKey(d).getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}

// The stay for the night of this day: booked first, else one that has these nights but is not booked yet.
// The last day only shows where the group checks out.
function NightStay({ day, trip, stays }: { day: string; trip: { start: string; end: string }; stays: Stay[] }) {
  const covering = stays.filter(s => s.nights && s.nights.checkIn <= day && day < s.nights.checkOut)
  const stay = covering.find(s => s.booked) ?? covering[0]
  if (day === trip.end) {
    const leaving = stays.find(s => s.booked && s.nights?.checkOut === day)
    return leaving ? <p className="text-sm text-muted">Check-out from <strong className="text-roche">{leaving.title ?? platformName(leaving)}</strong> today.</p> : null
  }
  if (!stay?.nights) {
    return (
      <Link to="../stays" className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-chemin-line bg-chemin-light px-4 py-3 text-sm text-chemin-dark hover:bg-chemin-light/70">
        <span><strong>No stay</strong> for this night yet</span>
        <span className="font-bold underline">Choose</span>
      </Link>
    )
  }
  const n = stay.nights
  const nightNo = nightCount({ checkIn: n.checkIn, checkOut: day }) + 1
  const where = stay.city ?? stay.location
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3', stay.booked ? 'bg-sommet text-white' : 'border border-line bg-white text-roche')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
        <path d="M3 21V10l9-6 9 6v11" /><path d="M9 21v-6h6v6" />
      </svg>
      <div className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate">{stay.title ?? platformName(stay)}</strong>
        <span className={cn('text-sm', stay.booked ? 'text-white/85' : 'text-muted')}>
          {[where, `night ${nightNo} of ${nightCount(n)}`, `check-out ${shortDayText(n.checkOut)}`, !stay.booked && 'not booked yet'].filter(Boolean).join(' · ')}
        </span>
      </div>
      <a href={stay.url} target="_blank" rel="noopener noreferrer" className={cn('shrink-0 text-sm font-bold underline', stay.booked ? 'text-white hover:text-white' : 'text-sommet')}>
        Open
      </a>
    </div>
  )
}

function DayActivities({ activities, canChange, onEdit }: {
  activities: Activity[]; canChange: (a: Activity) => boolean; onEdit: (a: Activity) => void
}) {
  if (!activities.length) return <p className="text-muted">Nothing planned for this day yet.</p>
  // In order of time; activities without a time come last, in the order they were added
  const sorted = [...activities].sort((a, b) => (a.calTime || '99:99').localeCompare(b.calTime || '99:99'))
  return (
    <ol aria-label="Activities of the day" className="flex flex-col gap-2.5">
      {sorted.map(a => (
        <li key={a._id} className="grid grid-cols-[3.25rem_1fr] gap-3">
          <span className="pt-3.5 text-sm font-bold text-subtle">{a.calTime || ''}</span>
          <ActivityCard activity={a} canChange={canChange(a)} onEdit={() => onEdit(a)} />
        </li>
      ))}
    </ol>
  )
}

function ActivityCard({ activity: a, canChange, onEdit }: { activity: Activity; canChange: boolean; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 shadow-card">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="wrap-anywhere">{a.text}</strong>
        {a.place && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.place)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-sm text-sommet hover:text-sommet-dark wrap-anywhere"
          >
            {a.place}
          </a>
        )}
        {a.note && <p className="text-sm whitespace-pre-line text-subtle wrap-anywhere">{a.note}</p>}
        <span className="text-xs text-muted">Added by {a.addedBy}</span>
      </div>
      {canChange && (
        <button type="button" onClick={onEdit} aria-label={`Change ${a.text}`} className="flex size-10 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-canvas hover:text-roche">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Add or change an activity. The day list has every day of the trip and "No day yet" for ideas.
function ActivityModal({ editing, days, defaultDay, plan, onClose }: {
  editing: Activity | 'new' | null; days: string[]; defaultDay: string | null; plan: TripPlan; onClose: () => void
}) {
  const old = editing && editing !== 'new' ? editing : null
  const [text, setText] = useState(old?.text ?? '')
  const [calDate, setCalDate] = useState(old ? old.calDate ?? '' : defaultDay ?? '')
  const [calTime, setCalTime] = useState(old?.calTime ?? '')
  const [place, setPlace] = useState(old?.place ?? '')
  const [note, setNote] = useState(old?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(job: () => Promise<string | null>) {
    setBusy(true)
    setError('')
    const problem = await job()
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || busy) return
    const input = { text, calDate: calDate || undefined, calTime: calDate && calTime ? calTime : undefined, place, note }
    run(() => (old ? plan.editActivity(old._id, input) : plan.addActivity(input)))
  }

  return (
    <Modal open={!!editing} onClose={onClose} title={old ? 'Change activity' : 'Add activity'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="What" placeholder="e.g. Dinner in Ubud" maxLength={80} required value={text} onChange={e => setText(e.target.value)} />
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">Day</span>
            <select
              value={calDate}
              onChange={e => setCalDate(e.target.value)}
              className="rounded-md border border-line-strong bg-white px-4 py-3.5 text-base text-roche focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none"
            >
              {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {shortDayText(d)}</option>)}
              <option value="">No day yet</option>
            </select>
          </label>
          <Input label="Time" type="time" value={calTime} disabled={!calDate} onChange={e => setCalTime(e.target.value)} className="w-32" />
        </div>
        <Input label="Place" placeholder="e.g. Tegallalang rice terraces" maxLength={120} value={place} onChange={e => setPlace(e.target.value)} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold">Note</span>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="e.g. Book a table, bring cash"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="rounded-md border border-line-strong bg-white px-4 py-3 text-base text-roche placeholder:text-faint focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none"
          />
        </label>
        {error && <p role="alert" className="text-caption text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {old ? (
            <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => run(() => plan.removeActivity(old._id))}>Remove</Button>
          ) : <span />}
          <Button type="submit" disabled={!text.trim() || busy}>{busy ? 'Saving…' : old ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  )
}
