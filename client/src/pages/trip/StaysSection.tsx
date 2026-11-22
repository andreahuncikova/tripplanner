import { useId, useState, type FormEvent } from 'react'
import type { Area, Stay, StayDetailsInput, TripSummary } from '@shared/types'
import { formatPrice, imageSrc, nightCount, nightsRange, nightsWord, platformName, shortDayText, stayTotal } from './stayFormat'
import { uploadFile } from '../../lib/files'
import { CurrencySelect } from '../../components/CurrencySelect'
import { addDays, fromKey } from '../../lib/plan'
import { nightsCover, type DayRange } from '@shared/nights'
import PhotoCarousel from './PhotoCarousel'
import OsmCredit from './OsmCredit'
import { useAuth } from '../../auth/useAuth'
import { Button, Card, Input, Modal, useToast } from '../../components/ui'
import { cn } from '../../lib/cn'
import type { TripStays } from '../../socket/useTripStays'

// The Stays tab from the Stays and Desk-Stays mockups: paste a link, sort the stays into areas, like them.
// "All" shows every stay; an area shows only its own. A new stay goes into the area that is open.
// The cards with photo, price and location from the preview come with the Stay cards task.
export default function StaysSection({ stays, trip }: { stays: TripStays; trip: TripSummary | null }) {
  const { user } = useAuth()
  // null: All
  const [areaId, setAreaId] = useState<string | null>(null)
  const [areasOpen, setAreasOpen] = useState(false)
  // An area that was just renamed away or another member's change: fall back to All
  const current = stays.areas.find(a => a._id === areaId) ?? null
  const shown = current ? stays.stays.filter(s => s.areaId === current._id) : stays.stays
  const count = (id: string) => stays.stays.filter(s => s.areaId === id).length
  // The trip's first and last day once its dates are set; the nights of a stay must lie inside them
  const tripDays: TripDays | null = trip?.finalDate && trip.tripDuration
    ? { start: trip.finalDate, end: addDays(trip.finalDate, trip.tripDuration - 1) } : null
  const [nightsFor, setNightsFor] = useState<Stay | null>(null)
  const [detailsFor, setDetailsFor] = useState<Stay | null>(null)

  return (
    <section aria-labelledby="stays-title" className="flex flex-col gap-4">
      {/* The tab in the menu already says where we are, so the title is only for screen readers */}
      <h2 id="stays-title" className="sr-only">Stays</h2>
      {tripDays && stays.loaded && <NightsBar tripDays={tripDays} stays={stays.stays} />}

      {/* The areas to filter by on the left, and the one main action of the tab on the right on a computer */}
      <div className="flex flex-col-reverse gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* One white switch like the menu: the areas to filter by, and the button to manage them at its end */}
      <div role="group" aria-label="Areas" className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-md bg-white p-1 shadow-card">
        <AreaChip label={`All · ${stays.stays.length}`} active={!current} onClick={() => setAreaId(null)} />
        {stays.areas.map(a => (
          <AreaChip key={a._id} label={`${a.name} · ${count(a._id)}`} active={current?._id === a._id} onClick={() => setAreaId(a._id)} />
        ))}
        <button
          type="button"
          onClick={() => setAreasOpen(true)}
          className="ml-1 min-h-8 border-l border-line pr-2.5 pl-3.5 text-sm font-semibold text-sommet hover:text-sommet-dark"
        >
          {stays.areas.length ? '+ Areas' : '+ Add area'}
        </button>
      </div>
      <AddStayForm stays={stays} areaId={current?._id ?? null} />
      </div>

      {!stays.loaded ? (
        <p className="text-muted">Loading stays…</p>
      ) : shown.length === 0 ? (
        <Card className="text-center text-muted">
          {current ? `No stays in ${current.name} yet. Paste a link above to add one.` : 'No stays yet. Paste a Booking.com or Airbnb link above, and the group can like the ones they want.'}
        </Card>
      ) : (
        <ul aria-label={current ? `Stays in ${current.name}` : 'All stays'} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(s => (
            <StayItem
              key={s._id}
              stay={s}
              areas={stays.areas}
              me={user?._id}
              canRemove={!!user && (s.addedByUserId === user._id || trip?.adminUserId === user._id)}
              stays={stays}
              onNights={() => setNightsFor(s)}
              onDetails={() => setDetailsFor(s)}
            />
          ))}
        </ul>
      )}
      {shown.some(s => s.cityCredit === 'osm') && <OsmCredit className="text-muted" />}

      <AreasModal open={areasOpen} onClose={() => setAreasOpen(false)} stays={stays} onAdded={setAreaId} />
      {/* The key opens it fresh for each stay, with that stay's nights filled in */}
      <NightsModal
        key={nightsFor?._id ?? 'none'}
        stay={nightsFor && (stays.stays.find(s => s._id === nightsFor._id) ?? nightsFor)}
        tripDays={tripDays}
        stays={stays}
        onClose={() => setNightsFor(null)}
      />
      <DetailsModal
        key={detailsFor ? `d-${detailsFor._id}` : 'd-none'}
        stay={detailsFor && (stays.stays.find(s => s._id === detailsFor._id) ?? detailsFor)}
        trip={trip}
        stays={stays}
        onClose={() => setDetailsFor(null)}
      />
    </section>
  )
}

function AreaChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-8 rounded-sm px-3.5 text-sm whitespace-nowrap transition-colors',
        active ? 'bg-roche font-semibold text-white' : 'font-medium text-muted hover:bg-canvas hover:text-roche',
      )}
    >
      {label}
    </button>
  )
}

function AddStayForm({ stays, areaId }: { stays: TripStays; areaId: string | null }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputId = useId()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    setError('')
    const problem = await stays.add(url.trim(), areaId)
    setBusy(false)
    if (problem) setError(problem)
    else setUrl('')
  }

  // One slim bar like a search field: a link icon, the field, and Add inside it
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5 lg:w-110">
      <div className={cn(
        'flex items-center gap-2 rounded-md border bg-white py-1 pr-1 pl-3.5 focus-within:border-sommet focus-within:ring-1 focus-within:ring-sommet',
        error ? 'border-danger' : 'border-transparent shadow-card',
      )}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-faint">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
        <label htmlFor={inputId} className="sr-only">Paste a stay link</label>
        <input
          id={inputId}
          type="url"
          inputMode="url"
          placeholder="Paste a Booking.com or Airbnb link…"
          value={url}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={e => { setUrl(e.target.value); setError('') }}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-roche placeholder:text-faint focus:outline-none lg:text-md"
        />
        <button
          type="submit"
          disabled={!url.trim() || busy || !stays.loaded}
          className="min-h-8 shrink-0 rounded-sm bg-sommet px-4 text-sm font-bold text-white hover:bg-sommet-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p id={`${inputId}-error`} className="px-3.5 text-caption text-danger">{error}</p>}
    </form>
  )
}

// Frosted glass on the photo: the small round and pill buttons of a card
const glass = 'border border-white/25 bg-white/15 text-white backdrop-blur-md hover:bg-white/25'

function StayItem({ stay: s, areas, me, canRemove, stays, onNights, onDetails }: {
  stay: Stay; areas: Area[]; me?: string; canRemove: boolean; stays: TripStays; onNights: () => void; onDetails: () => void
}) {
  const name = s.title ?? platformName(s)
  const details = [s.location, s.price && `${formatPrice(s.price)} / night`].filter(Boolean).join(' · ')
  const photos = s.images?.length ? s.images : s.image ? [s.image] : []

  // The photo fills the card, with the area and the like on top and the name, the nights and the rest on a dark fade
  // at the bottom. A stay without photos gets a dark gradient in its place, so every card looks the same.
  return (
    <li className="min-w-0">
      <article className="relative isolate flex h-84 flex-col justify-between overflow-hidden rounded-lg bg-linear-to-br from-sommet-dark to-roche shadow-card">
        {photos.length ? (
          <PhotoCarousel images={photos} credits={s.imageCredits} label={name} href={s.url} />
        ) : (
          <a href={s.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="absolute inset-0" />
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/35 to-transparent" />

        <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2 p-3 [&_a,&_button,&_select]:pointer-events-auto">
          <AreaSelect stay={s} areas={areas} stays={stays} name={name} />
          <LikeButton stay={s} me={me} stays={stays} />
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
        <div className="pointer-events-none relative z-10 flex flex-col gap-2.5 p-4 text-white [&_a,&_button,&_select]:pointer-events-auto">
          <div className="flex min-w-0 flex-col">
            {/* Without a title the name already is the platform, so it is not written twice */}
            {s.title && <span className="text-2xs font-bold tracking-wider text-white/70 uppercase">{platformName(s)}</span>}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate font-bold text-white hover:text-white hover:underline">{name}</a>
            {details && <span className="truncate text-sm text-white/80">{details}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1"><NightsButton stay={s} name={name} onPhoto onClick={onNights} /></div>
            {s.nights && <BookedButton stay={s} name={name} onPhoto stays={stays} />}
            <button
              type="button"
              onClick={onDetails}
              aria-label={`${photos.length ? 'Edit' : 'Add'} details of ${name}`}
              title={photos.length ? 'Edit details' : 'Add details'}
              className={cn('flex size-9 shrink-0 items-center justify-center rounded-sm', glass)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
              </svg>
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => stays.remove(s._id)}
                aria-label={`Remove ${name}`}
                title="Remove"
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-sm', glass)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </article>
    </li>
  )
}

// The area as a small glass pill with its own arrow, instead of the browser's square list
function AreaSelect({ stay: s, areas, stays, name }: { stay: Stay; areas: Area[]; stays: TripStays; name: string }) {
  return (
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">Area for {name}</span>
      <select
        value={s.areaId ?? ''}
        onChange={e => stays.move(s._id, e.target.value || null)}
        className={cn('min-h-8 max-w-44 cursor-pointer appearance-none truncate rounded-sm py-1 pr-7 pl-3 text-xs font-bold [&>option]:text-roche', glass)}
      >
        <option value="">No area</option>
        {areas.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="pointer-events-none absolute right-2.5 text-white">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  )
}

function LikeButton({ stay: s, me, stays }: { stay: Stay; me?: string; stays: TripStays }) {
  const liked = !!me && s.likeUserIds.includes(me)
  const likes = s.likeUserIds.length
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={`${liked ? 'Liked by you' : 'Like'}, ${likes} ${likes === 1 ? 'like' : 'likes'}`}
      onClick={() => stays.like(s._id)}
      className={cn('flex min-h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-bold', liked ? 'bg-white text-danger' : glass)}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
      </svg>
      {likes}
    </button>
  )
}

type TripDays = { start: string; end: string }

// One problem with the nights: its name and each run of nights it is about, written like the nights on a card,
// check-in to check-out: "13 – 15 Jun · 2 nights"
function NightsWarning({ tone, title, runs }: { tone: 'none' | 'double'; title: string; runs: DayRange[] }) {
  const color = tone === 'none' ? 'text-chemin' : 'text-[#ff8f80]'
  return (
    <div role="group" aria-label={title} className={cn('flex min-w-0 flex-1 items-start gap-3 rounded-xl bg-white/6 p-3 ring-1 ring-inset', tone === 'none' ? 'ring-chemin/40' : 'ring-[#ff8f80]/40')}>
      <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold', tone === 'none' ? 'bg-chemin/15' : 'bg-[#ff8f80]/15', color)}>
        {tone === 'none' ? '!' : '2×'}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <strong className="text-sm text-white">{title}</strong>
        <ul className="flex flex-col gap-0.5 text-sm text-white/85">
          {runs.map(r => {
            const n = { checkIn: r.first, checkOut: addDays(r.last, 1) }
            return <li key={r.first}>{nightsRange(n)} · <span className={cn('font-semibold', color)}>{nightsWord(nightCount(n))}</span></li>
          })}
        </ul>
      </div>
    </div>
  )
}

// The trip's nights in the style of the Itinerary calendar: a small tile for each night with its day, its date and
// the stay that covers it, on a dark card like the step card on the Plan tab. The line on top is blue when a booked
// stay covers the night, rose when two do, faint when none does. Under the tiles the nights still without a stay, so nobody arrives somewhere with no bed.
const nightDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

function NightsBar({ tripDays, stays }: { tripDays: TripDays; stays: Stay[] }) {
  const cover = nightsCover(tripDays, stays)
  const total = cover.nights.length
  if (total === 0) return null
  const done = cover.gaps.length === 0
  const stayName = (id: string) => {
    const s = stays.find(x => x._id === id)
    return s ? s.title ?? platformName(s) : ''
  }
  const ring = 2 * Math.PI * 18
  return (
    <section aria-label="Nights" className="mb-4 flex flex-col gap-4 rounded-[18px] bg-sommet p-4.5 text-white lg:p-5.5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
      {/* How many nights are booked, as a ring that fills up */}
      <div className="flex shrink-0 items-center gap-3.5 md:pt-1">
        <svg width="52" height="52" viewBox="0 0 44 44" aria-hidden="true" className="-rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" className="stroke-white/15" />
          <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={ring * (1 - cover.booked / total)}
            className="stroke-ciel transition-[stroke-dashoffset] duration-700" />
        </svg>
        <div className="flex flex-col leading-tight">
          <span className={cn('text-title font-extrabold', done && 'text-ciel')}>{cover.booked} of {total}</span>
          <span className={cn('text-sm', done && cover.doubles.length === 0 ? 'font-semibold text-ciel' : 'text-white/70')}>
            {done && cover.doubles.length === 0 ? 'Every night has a stay' : 'nights booked'}
          </span>
        </div>
      </div>
      <ol aria-label="Nights of the trip" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {cover.nights.map(n => {
          const state = n.stayIds.length > 1 ? 'booked twice' : n.stayIds.length ? 'booked' : 'no stay'
          const date = fromKey(n.day)
          return (
            <li
              key={n.day}
              title={`${shortDayText(n.day)}: ${state}`}
              aria-label={`Night of ${shortDayText(n.day)}: ${state}`}
              className={cn(
                'flex min-w-24 flex-1 flex-col gap-0.5 border-t-2 pt-2',
                n.stayIds.length > 1 ? 'border-[#ff8f80]' : n.stayIds.length ? 'border-ciel' : 'border-white/20',
              )}
            >
              <span className="text-2xs font-bold tracking-wider text-white/70 uppercase">{nightDay.format(date)}</span>
              <span className="text-lg leading-6 font-semibold">{String(date.getDate()).padStart(2, '0')}</span>
              <span className={cn('truncate text-xs', n.stayIds.length ? 'font-semibold text-white' : 'text-chemin')}>
                {n.stayIds.length ? n.stayIds.map(stayName).join(' + ') : 'No stay'}
              </span>
            </li>
          )
        })}
      </ol>
      </div>
      {/* The problems take the whole width of the card, under the ring and the nights */}
      {(!done || cover.doubles.length > 0) && (
        // What still needs doing, as one box per problem with its nights listed under it; one box alone takes the whole width:
        // amber for nights without a bed, rose for nights two stays are booked for
        <div role="status" className="flex flex-col gap-2.5 sm:flex-row">
          {!done && <NightsWarning tone="none" title="No stay booked" runs={cover.gaps} />}
          {cover.doubles.length > 0 && <NightsWarning tone="double" title="Two stays booked" runs={cover.doubles} />}
        </div>
      )}
    </section>
  )
}

// "Mark booked" once the nights are chosen; a filled "Booked" after that, which a tap takes back
function BookedButton({ stay: s, name, onPhoto, stays }: { stay: Stay; name: string; onPhoto: boolean; stays: TripStays }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  async function toggle() {
    setBusy(true)
    const problem = await stays.setBooked(s._id, !s.booked)
    setBusy(false)
    if (problem) toast(problem)
  }
  return (
    <button
      type="button"
      aria-pressed={s.booked}
      aria-label={`Booked: ${name}`}
      disabled={busy}
      onClick={toggle}
      className={cn(
        'flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3.5 text-sm font-bold whitespace-nowrap disabled:opacity-60',
        s.booked ? 'bg-success text-white hover:bg-success/90'
          : onPhoto ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25'
          : 'border border-line bg-white text-subtle hover:border-line-strong',
      )}
    >
      {s.booked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {s.booked ? 'Booked' : 'Mark booked'}
    </button>
  )
}

// "Choose nights", or once chosen "17 – 20 Jun · 3 nights · €360"; opens the NightsModal
function NightsButton({ stay: s, name, onPhoto, onClick }: { stay: Stay; name: string; onPhoto: boolean; onClick: () => void }) {
  const n = s.nights
  const text = n
    ? [nightsRange(n), nightsWord(nightCount(n)), s.price && formatPrice(stayTotal(s.price, n))].filter(Boolean).join(' · ')
    : 'Choose nights'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={n ? `Nights for ${name}: ${text}. Change` : `Choose nights for ${name}`}
      className={cn(
        'flex min-h-9 w-full items-center gap-2 rounded-sm px-3.5 text-left text-sm font-semibold',
        onPhoto ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25'
          : n ? 'bg-ciel-light text-sommet hover:bg-ciel/40'
          : 'border border-dashed border-line-strong bg-white text-subtle hover:bg-canvas',
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
      <span className="truncate">{text}</span>
    </button>
  )
}

// Check-in and check-out of one stay, with the total price as they change. Inside the trip dates once they are set.
function NightsModal({ stay, tripDays, stays, onClose }: {
  stay: Stay | null; tripDays: TripDays | null; stays: TripStays; onClose: () => void
}) {
  const [checkIn, setCheckIn] = useState(stay?.nights?.checkIn ?? tripDays?.start ?? '')
  const [checkOut, setCheckOut] = useState(stay?.nights?.checkOut ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = !!checkIn && !!checkOut && checkOut > checkIn
  const nights = valid ? { checkIn, checkOut } : null

  async function save(value: typeof nights) {
    if (!stay || busy) return
    setBusy(true)
    const problem = await stays.setNights(stay._id, value)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (nights) save(nights)
  }

  const name = stay ? stay.title ?? platformName(stay) : ''
  return (
    <Modal open={!!stay} onClose={onClose} title="Nights" description={name}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Check-in"
            type="date"
            value={checkIn}
            min={tripDays?.start}
            max={tripDays ? addDays(tripDays.end, -1) : undefined}
            onChange={e => {
              const v = e.target.value
              setCheckIn(v)
              setError('')
              // Keep check-out after check-in
              if (v && checkOut && checkOut <= v) setCheckOut(addDays(v, 1))
            }}
          />
          <Input
            label="Check-out"
            type="date"
            value={checkOut}
            min={checkIn ? addDays(checkIn, 1) : tripDays?.start}
            max={tripDays?.end}
            onChange={e => { setCheckOut(e.target.value); setError('') }}
          />
        </div>
        {tripDays && <p className="text-caption text-muted">The trip is {nightsRange({ checkIn: tripDays.start, checkOut: tripDays.end })}.</p>}

        <div aria-live="polite" className="flex items-baseline justify-between rounded-lg bg-canvas px-4 py-3">
          <span className="font-semibold">{nights ? nightsWord(nightCount(nights)) : 'Choose the days'}</span>
          {nights && stay?.price && (
            <span className="text-right">
              <strong className="text-lg">{formatPrice(stayTotal(stay.price, nights))}</strong>
              <span className="block text-caption text-muted">{formatPrice(stay.price)} × {nightCount(nights)}</span>
            </span>
          )}
        </div>
        {!stay?.price && nights && <p className="text-caption text-muted">The link did not share a price, so there is no total yet.</p>}
        {error && <p role="alert" className="text-caption text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {stay?.nights ? (
            <Button type="button" variant="link" size="sm" className="px-0" disabled={busy} onClick={() => save(null)}>Clear nights</Button>
          ) : <span />}
          <Button type="submit" disabled={!nights || busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// Fill in or correct a stay by hand: for links whose site shares nothing (Booking), or a wrong price.
// A new photo is uploaded to our file storage first, then the form is saved.
function DetailsModal({ stay, trip, stays, onClose }: {
  stay: Stay | null; trip: TripSummary | null; stays: TripStays; onClose: () => void
}) {
  const [title, setTitle] = useState(stay?.title ?? '')
  const [amount, setAmount] = useState(stay?.price ? String(stay.price.amount) : '')
  const [currency, setCurrency] = useState(stay?.price?.currency ?? trip?.currency ?? 'EUR')
  const [location, setLocation] = useState(stay?.location ?? '')
  // 'keep' the photos it has, null to remove them, or a photo picked now
  const [photo, setPhoto] = useState<'keep' | null | File>('keep')
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const current = stay?.image
  const shownPhoto = photo instanceof File ? preview : photo === 'keep' && current ? imageSrc(current) : null
  const price = Number(amount.replace(',', '.'))

  function pick(file: File | undefined) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Please choose a JPG, PNG or WebP photo'); return }
    setError('')
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!stay || !trip || busy) return
    if (amount.trim() && !(price > 0)) { setError('Please enter a price per night above 0'); return }
    setBusy(true)
    setError('')
    let image: StayDetailsInput['image'] = photo instanceof File ? 'keep' : photo
    if (photo instanceof File) {
      try {
        image = (await uploadFile(photo, { kind: 'stay', trip: trip.inviteCode })).url
      } catch (err) {
        setBusy(false)
        setError((err as Error).message)
        return
      }
    }
    const problem = await stays.editDetails(stay._id, {
      title, location, image, price: amount.trim() ? { amount: price, currency } : null,
    })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Modal open={!!stay} onClose={onClose} title={stay?.complete ? 'Edit details' : 'Add details'} description={stay ? platformName(stay) : ''}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Name" placeholder="e.g. Casa Azul" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 items-start gap-3">
          <Input label="Price per night" inputMode="decimal" placeholder="e.g. 120" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} />
          <CurrencySelect label="Currency" labelClassName="text-sm font-bold" value={currency} onChange={setCurrency} />
        </div>
        <Input label="Location" placeholder="e.g. Ubud, Indonesia" maxLength={120} value={location} onChange={e => setLocation(e.target.value)}
          hint="City first, then the country" />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Photo</span>
          <div className="flex items-center gap-3">
            {shownPhoto
              ? <img src={shownPhoto} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
              : <div className="size-16 shrink-0 rounded-lg bg-canvas" aria-hidden="true" />}
            <label className="cursor-pointer rounded-md border border-line-strong px-3.5 py-2 text-sm font-bold text-roche hover:bg-canvas focus-within:ring-2 focus-within:ring-sommet">
              {shownPhoto ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
            </label>
            {shownPhoto && (
              <Button type="button" variant="link" size="sm" className="px-1" onClick={() => { setPhoto(null); setPreview(null) }}>Remove</Button>
            )}
          </div>
        </div>

        {error && <p role="alert" className="text-caption text-danger">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </form>
    </Modal>
  )
}

// "Areas" from the AddArea mockup: the trip's areas with Rename, and a field for a new one
function AreasModal({ open, onClose, stays, onAdded }: {
  open: boolean; onClose: () => void; stays: TripStays; onAdded: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const count = (id: string) => stays.stays.filter(s => s.areaId === id).length

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    const result = await stays.addArea(name)
    setBusy(false)
    if ('error' in result) { setError(result.error); return }
    setName('')
    setError('')
    onAdded(result.id)
  }

  function saveRename(e: FormEvent) {
    e.preventDefault()
    if (renaming && renaming.name.trim()) stays.renameArea(renaming.id, renaming.name)
    setRenaming(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="Areas" description="Split the trip into places you stay in. Each area gets its own list of stays.">
      <div className="flex flex-col gap-4">
        {stays.areas.length > 0 && (
          <ul className="flex flex-col rounded-lg border border-line">
            {stays.areas.map(a => (
              <li key={a._id} className="flex items-center gap-2.5 border-b border-line px-3.5 py-2 last:border-b-0">
                {renaming?.id === a._id ? (
                  <form onSubmit={saveRename} className="flex flex-1 items-center gap-2">
                    <input
                      aria-label={`New name for ${a.name}`}
                      value={renaming.name}
                      maxLength={40}
                      autoFocus
                      onChange={e => setRenaming({ id: a._id, name: e.target.value })}
                      className="min-w-0 flex-1 rounded-md border border-sommet px-3 py-2 text-base"
                    />
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                ) : (
                  <>
                    <strong className="flex-1">{a.name}</strong>
                    <span className="text-sm text-muted">{count(a._id)} {count(a._id) === 1 ? 'stay' : 'stays'}</span>
                    <Button variant="link" size="sm" className="px-2" aria-label={`Rename ${a.name}`} onClick={() => setRenaming({ id: a._id, name: a.name })}>
                      Rename
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input label="New area" placeholder="e.g. Ubud" maxLength={40} value={name} error={error || undefined}
              onChange={e => { setName(e.target.value); setError('') }} />
          </div>
          <Button type="submit" disabled={!name.trim() || busy} className={cn('shrink-0', error && 'mb-7')}>Add</Button>
        </form>
      </div>
    </Modal>
  )
}
