import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Activity, Member, Stay } from '@shared/types'
import { nightsCover, type DayRange } from '@shared/nights'
import { useAuth } from '../../../auth/useAuth'
import { Avatar, Button, Input, Modal } from '../../../components/ui'
import { ChevronDownIcon, EditIcon, PinIcon, PlusIcon, StaysIcon } from '../../../components/layout/icons'
import { cn } from '../../../lib/cn'
import { addDays, dayLabel, fromKey } from '../../../lib/plan'
import type { TripPlan } from '../../../socket/useTripPlan'
import type { TripStays } from '../../../socket/useTripStays'
import { imageSrc, nightCount, nightsRange, nightsWord, platformName, shortDayText } from '../stayFormat'

type TripDays = { start: string; end: string }

// The Itinerary tab: the trip as a calendar, week by week from Monday to Sunday. Each day of the trip shows its
// activities; a tap opens the day on the right (on phones below), with where the group sleeps that night and all
// its activities. An amber dot marks a night without a booked stay. Activities without a day are ideas for later.
export default function ItinerarySection({ plan, stays }: { plan: TripPlan; stays: TripStays }) {
  const { user } = useAuth()
  const state = plan.state
  const [picked, setPicked] = useState<string | null>(null)
  // null: closed; a day ("YYYY-MM-DD") or '' (no day): a new activity for it; or the activity being changed
  const [editing, setEditing] = useState<Activity | string | null>(null)

  if (!state) return <p className="text-muted">Loading the itinerary…</p>

  const trip: TripDays | null = state.finalDate && state.tripDuration
    ? { start: state.finalDate, end: addDays(state.finalDate, state.tripDuration - 1) } : null
  const days = trip ? Array.from({ length: state.tripDuration! }, (_, i) => addDays(trip.start, i)) : []
  const cover = trip ? nightsCover(trip, stays.stays) : null
  const today = new Date().toISOString().slice(0, 10)
  const day = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0] ?? null
  const ideas = state.activities.filter(a => !a.calDate || !days.includes(a.calDate))
  const canChange = (a: Activity) => !!user && (a.userId === user._id || state.adminUserId === user._id)
  const author = (a: Activity) => state.members.find(m => m.userId === a.userId)
  const card = (a: Activity) => (
    <ActivityCard activity={a} author={author(a)} canChange={canChange(a)} onEdit={() => setEditing(a)} />
  )
  const on = (d: string) => sortByTime(state.activities.filter(a => a.calDate === d))

  return (
    <section aria-labelledby="itinerary-title" className="flex w-full flex-col gap-6">
      {/* The tab in the menu already says where we are, so the title is only for screen readers */}
      <h2 id="itinerary-title" className="sr-only">Itinerary</h2>
      <div className="flex items-center justify-between gap-3">
        <p className="text-title font-extrabold lg:text-2xl">{trip ? monthsText(trip) : 'Ideas'}</p>
        <Button size="sm" onClick={() => setEditing(day ?? '')} className="shrink-0"><PlusIcon />Add activity</Button>
      </div>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {trip ? (
          <Calendar trip={trip} days={days} day={day!} cover={cover!} activitiesOn={on} onPick={setPicked} />
        ) : (
          <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-line-strong px-5 py-4.5">
            <p className="font-bold">The days appear once the trip has dates.</p>
            <p className="text-sm text-muted">Until then, add ideas for things to do, and give them a day later.</p>
            <Link to="../plan" className="mt-1 text-sm font-bold">Go to the dates</Link>
          </div>
        )}

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          {trip && (
            <section aria-labelledby="day-title" className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="day-title" className="text-lg font-extrabold">{dayLabel(day!)}</h3>
                <span className="shrink-0 text-sm font-semibold text-muted">Day {days.indexOf(day!) + 1} of {days.length}</span>
              </div>
              <NightStay day={day!} trip={trip} stays={stays.stays} />
              <DayActivities day={day!} activities={on(day!)} card={card} />
              <button
                type="button"
                onClick={() => setEditing(day!)}
                className="flex items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong py-2.5 text-sm font-bold text-subtle hover:border-sommet hover:text-sommet"
              >
                <PlusIcon />Add to this day
              </button>
            </section>
          )}

          {cover && cover.gaps.length > 0 && (
            <p role="status" className="flex items-start gap-2.5 text-sm text-chemin-dark">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-chemin" />
              <span>
                <strong>No stay booked</strong> for {cover.gaps.map(gapText).join(', ')}.{' '}
                <Link to="../stays" className="font-bold text-chemin-dark underline hover:text-roche">Choose a stay</Link>
              </span>
            </p>
          )}

          {ideas.length > 0 && (
            <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
              <h3 id="ideas-title" className="text-2xs font-extrabold tracking-wider text-muted uppercase">Ideas without a day</h3>
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                {ideas.map(a => <li key={a._id} className="flex">{card(a)}</li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <ActivityModal
        key={typeof editing === 'string' ? `new-${editing}` : editing?._id ?? 'none'}
        editing={editing}
        days={days}
        plan={plan}
        onClose={() => setEditing(null)}
      />
    </section>
  )
}

// In order of time; activities without a time come last, in the order they were added
const sortByTime = (list: Activity[]) => [...list].sort((a, b) => (a.calTime || '99:99').localeCompare(b.calTime || '99:99'))

// "13 – 15 Jun (2 nights)", as in the Stays tab
const gapText = (r: DayRange) => {
  const n = { checkIn: r.first, checkOut: addDays(r.last, 1) }
  return `${nightsRange(n)} (${nightsWord(nightCount(n))})`
}

const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' })
// "March 2027", or "December 2026 – February 2027" for a trip over several months
function monthsText(trip: TripDays) {
  const a = monthYear.format(fromKey(trip.start))
  const b = monthYear.format(fromKey(trip.end))
  return a === b ? a : `${a} – ${b}`
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// The weeks of the trip, Monday to Sunday. Days before and after the trip are greyed out; each trip day is a button
// with its activities (at most two, then "+ 2 more") and an amber dot when its night has no booked stay.
function Calendar({ trip, days, day, cover, activitiesOn, onPick }: {
  trip: TripDays; days: string[]; day: string; cover: ReturnType<typeof nightsCover>
  activitiesOn: (d: string) => Activity[]; onPick: (d: string) => void
}) {
  // From the Monday on or before the first day to the Sunday on or after the last
  const first = addDays(trip.start, -((fromKey(trip.start).getDay() + 6) % 7))
  const last = addDays(trip.end, 6 - ((fromKey(trip.end).getDay() + 6) % 7))
  const cells: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div aria-hidden="true" className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {WEEKDAYS.map(w => <span key={w} className="text-2xs font-bold tracking-wider text-muted uppercase">{w}</span>)}
      </div>
      <div role="group" aria-label="Days of the trip" className="grid grid-cols-7 gap-x-1.5 gap-y-4 sm:gap-x-3 sm:gap-y-6">
        {cells.map(d => {
          if (d < trip.start || d > trip.end) {
            return (
              <div key={d} aria-hidden="true" className="min-h-20 border-t-2 border-line pt-2 sm:min-h-32">
                <span className="text-lg font-semibold text-faint/70 sm:text-2xl">{String(fromKey(d).getDate()).padStart(2, '0')}</span>
              </div>
            )
          }
          // The last day has no night; every other day gets an amber dot when its night has no booked stay
          const noStay = d !== trip.end && !cover.nights.find(n => n.day === d)?.stayIds.length
          const active = d === day
          const list = activitiesOn(d)
          const date = fromKey(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              aria-label={`${dayLabel(d)}${noStay ? ', no stay booked for the night' : ''}`}
              onClick={() => onPick(d)}
              className={cn(
                'group flex min-h-20 min-w-0 flex-col items-start gap-1.5 border-t-2 px-1 pt-2 pb-2 text-left transition-colors sm:min-h-32 sm:px-2',
                'focus-visible:outline-2 focus-visible:outline-sommet',
                active ? 'border-sommet bg-white shadow-card' : 'border-line-strong hover:bg-white/70',
              )}
            >
              <span className="flex w-full items-center gap-1.5">
                <span className={cn('text-lg font-semibold sm:text-2xl', active ? 'text-sommet' : 'text-roche')}>{String(date.getDate()).padStart(2, '0')}</span>
                {(date.getDate() === 1 || d === days[0]) && <span className="text-2xs font-bold text-muted uppercase">{monthShort.format(date)}</span>}
                {noStay && <span aria-hidden="true" className="ml-auto size-1.5 shrink-0 rounded-full bg-chemin" />}
              </span>
              {/* Phones: a dot for each activity. Bigger screens: the first two with their times. */}
              <span aria-hidden="true" className="flex gap-1 sm:hidden">
                {list.slice(0, 4).map(a => <span key={a._id} className="size-1.5 rounded-full bg-sommet" />)}
              </span>
              <span aria-hidden="true" className="hidden w-full min-w-0 flex-col gap-1.5 sm:flex">
                {list.slice(0, 2).map(a => (
                  <span key={a._id} className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-xs font-bold text-roche">{a.text}</span>
                    {a.calTime && <span className="text-2xs text-muted">{a.calTime}</span>}
                  </span>
                ))}
                {list.length > 2 && <span className="text-2xs font-bold text-sommet underline">+ {list.length - 2} more</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const stayIcon = (className: string) => (
  <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-sm', className)}><StaysIcon /></span>
)

// Where the group sleeps after this day: the booked stay first, else one that has these nights but is not booked
// yet. The last day only says where the group checks out.
function NightStay({ day, trip, stays }: { day: string; trip: TripDays; stays: Stay[] }) {
  const covering = stays.filter(s => s.nights && s.nights.checkIn <= day && day < s.nights.checkOut)
  const stay = covering.find(s => s.booked) ?? covering[0]
  if (day === trip.end) {
    const leaving = stays.find(s => s.booked && s.nights?.checkOut === day)
    return <p className="text-sm text-muted">{leaving ? <>Check-out from <strong className="text-roche">{leaving.title ?? platformName(leaving)}</strong> today.</> : 'The last day of the trip.'}</p>
  }
  if (!stay?.nights) {
    return (
      <Link to="../stays" className="group flex items-center gap-3 rounded-sm bg-chemin-light p-2 pr-3.5 text-sm text-chemin-dark hover:text-chemin-dark">
        {stayIcon('bg-white/70 text-chemin-dark')}
        <span className="flex-1"><strong>No stay</strong> for this night yet</span>
        <span className="font-bold group-hover:underline">Choose</span>
      </Link>
    )
  }
  const n = stay.nights
  const nightNo = nightCount({ checkIn: n.checkIn, checkOut: day }) + 1
  const where = stay.city ?? stay.location
  const photo = stay.images?.[0] ?? stay.image
  return (
    <a href={stay.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-sm bg-canvas p-2 pr-3.5 text-roche hover:text-roche hover:shadow-card">
      {photo
        ? <img src={imageSrc(photo)} alt="" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-sm object-cover" />
        : stayIcon(stay.booked ? 'bg-sommet text-white' : 'bg-white text-subtle')}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <strong className="truncate text-sm">{stay.title ?? platformName(stay)}</strong>
          {!stay.booked && <span className="shrink-0 rounded-[6px] bg-chemin-light px-1.5 py-0.5 text-2xs font-bold text-chemin-dark">not booked</span>}
        </span>
        <span className="text-xs text-muted">{where && `${where} · `}night {nightNo} of {nightCount(n)} · check-out {shortDayText(n.checkOut)}</span>
      </span>
    </a>
  )
}

function DayActivities({ day, activities, card }: { day: string; activities: Activity[]; card: (a: Activity) => ReactNode }) {
  if (!activities.length) return <p className="text-sm text-muted">Nothing planned for this day yet.</p>
  return (
    <ol aria-label={`Activities on ${dayLabel(day)}`} className="flex flex-col gap-2">
      {activities.map(a => (
        <li key={a._id} className="flex">
          {card(a)}
        </li>
      ))}
    </ol>
  )
}

function ActivityCard({ activity: a, author, canChange, onEdit }: {
  activity: Activity; author?: Member; canChange: boolean; onEdit: () => void
}) {
  return (
    <div className="group flex w-full items-start gap-3 rounded-lg bg-white py-3.5 pr-2.5 pl-4 shadow-card">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {a.calDate && a.calTime && <span className="text-xs font-bold text-sommet tabular-nums">{a.calTime}</span>}
        <strong className="wrap-anywhere">{a.text}</strong>
        {a.place && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.place)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex w-fit items-center gap-1 text-sm font-semibold wrap-anywhere"
          >
            <PinIcon />{a.place}
          </a>
        )}
        {a.note && <p className="text-sm whitespace-pre-line text-muted wrap-anywhere">{a.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canChange && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Change ${a.text}`}
            className="flex size-9 items-center justify-center rounded-md text-subtle hover:bg-canvas hover:text-roche focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          >
            <EditIcon />
          </button>
        )}
        <span title={`Added by ${a.addedBy}`} className="flex size-9 items-center justify-center">
          <Avatar name={a.addedBy} color={author?.color ?? '#8a96a6'} size="xs" />
          <span className="sr-only">, added by {a.addedBy}</span>
        </span>
      </div>
    </div>
  )
}

// The same look as Input, for the select and the textarea, which Input does not cover
const field = cn(
  'w-full min-w-0 rounded-md border border-line-strong bg-white px-4 py-3 text-base text-roche placeholder:text-faint lg:py-2.5 lg:text-md',
  'focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none',
)

// Add or change an activity. The day list has every day of the trip and "No day yet" for ideas.
function ActivityModal({ editing, days, plan, onClose }: {
  editing: Activity | string | null; days: string[]; plan: TripPlan; onClose: () => void
}) {
  // A string is the day a new activity is for ('' for an idea without a day)
  const old = editing && typeof editing !== 'string' ? editing : null
  const [text, setText] = useState(old?.text ?? '')
  const [calDate, setCalDate] = useState(old ? old.calDate ?? '' : typeof editing === 'string' ? editing : '')
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
    <Modal open={editing !== null} onClose={onClose} title={old ? 'Change activity' : 'Add activity'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="What" placeholder="e.g. Dinner in Ubud" maxLength={80} required autoComplete="off" value={text} onChange={e => setText(e.target.value)} />
        <div className="grid grid-cols-[1fr_8.5rem] gap-3">
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-bold">Day</span>
            <span className="relative">
              <select value={calDate} onChange={e => setCalDate(e.target.value)} className={cn(field, 'appearance-none pr-10')}>
                {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {shortDayText(d)}</option>)}
                <option value="">No day yet</option>
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-subtle"><ChevronDownIcon /></span>
            </span>
          </label>
          <Input label="Time" type="time" value={calTime} disabled={!calDate} onChange={e => setCalTime(e.target.value)} className="disabled:bg-canvas disabled:text-faint" />
        </div>
        <Input label="Place" placeholder="e.g. Tegallalang rice terraces" maxLength={120} value={place} onChange={e => setPlace(e.target.value)} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold">Note</span>
          <textarea
            rows={2}
            maxLength={500}
            placeholder="e.g. Book a table, bring cash"
            value={note}
            onChange={e => setNote(e.target.value)}
            className={cn(field, 'resize-none')}
          />
        </label>
        {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-1 flex items-center gap-2">
          {old && (
            <Button type="button" variant="link" disabled={busy} onClick={() => run(() => plan.removeActivity(old._id))} className="mr-auto text-danger hover:text-danger/80">
              Remove
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} className={cn(!old && 'ml-auto')}>Cancel</Button>
          <Button type="submit" disabled={!text.trim() || busy}>{busy ? 'Saving…' : old ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  )
}
