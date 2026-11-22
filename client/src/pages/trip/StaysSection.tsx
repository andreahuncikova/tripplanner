import { useState, type FormEvent } from 'react'
import type { Area, Stay, TripSummary } from '@shared/types'
import { formatPrice, nightCount, nightsRange, nightsWord, platformName, shortDayText, stayTotal } from './stayFormat'
import { addDays } from '../../lib/plan'
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

  return (
    <section aria-labelledby="stays-title" className="flex flex-col gap-4">
      <h2 id="stays-title" className="text-2xl font-extrabold">Stays</h2>
      {tripDays && stays.loaded && <NightsBar tripDays={tripDays} stays={stays.stays} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div role="group" aria-label="Areas" className="flex flex-wrap gap-2 lg:flex-1">
          <AreaChip label={`All · ${stays.stays.length}`} active={!current} onClick={() => setAreaId(null)} />
          {stays.areas.map(a => (
            <AreaChip key={a._id} label={`${a.name} · ${count(a._id)}`} active={current?._id === a._id} onClick={() => setAreaId(a._id)} />
          ))}
          <button
            type="button"
            onClick={() => setAreasOpen(true)}
            className="min-h-10 rounded-full border border-dashed border-faint bg-white px-3.5 text-sm font-bold text-subtle hover:bg-canvas"
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
        <ul aria-label={current ? `Stays in ${current.name}` : 'All stays'} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(s => (
            <StayItem
              key={s._id}
              stay={s}
              areas={stays.areas}
              me={user?._id}
              canRemove={!!user && (s.addedByUserId === user._id || trip?.adminUserId === user._id)}
              stays={stays}
              onNights={() => setNightsFor(s)}
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
        'min-h-10 rounded-full px-3.5 text-sm whitespace-nowrap',
        active ? 'bg-roche font-bold text-white' : 'border border-line-strong bg-white font-semibold text-roche hover:bg-canvas',
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

  return (
    <form onSubmit={submit} className="flex items-start gap-2 lg:w-105">
      <div className="min-w-0 flex-1">
        <Input
          label="Paste a stay link"
          hideLabel
          type="url"
          inputMode="url"
          placeholder="Paste a Booking.com or Airbnb link…"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          error={error || undefined}
          className="py-3"
        />
      </div>
      <Button type="submit" disabled={!url.trim() || busy || !stays.loaded} className="min-h-12.5 shrink-0">
        {busy ? 'Adding…' : 'Add'}
      </Button>
    </form>
  )
}

function StayItem({ stay: s, areas, me, canRemove, stays, onNights }: {
  stay: Stay; areas: Area[]; me?: string; canRemove: boolean; stays: TripStays; onNights: () => void
}) {
  const name = s.title ?? platformName(s)
  const details = [s.location, s.price && `${formatPrice(s.price)} / night`].filter(Boolean).join(' · ')
  const photos = s.images?.length ? s.images : s.image ? [s.image] : []
  const onPhoto = photos.length > 0
  const controls = <StayControls stay={s} areas={areas} me={me} canRemove={canRemove} stays={stays} name={name} onPhoto={onPhoto} />
  const nights = (
    // Side by side when the card is wide enough, else Booked goes under the nights so they are not cut off
    <div className="@container">
      <div className="flex flex-col gap-2 @xs:flex-row @xs:items-center">
        <div className="min-w-0 flex-1"><NightsButton stay={s} name={name} onPhoto={onPhoto} onClick={onNights} /></div>
        {s.nights && <BookedButton stay={s} name={name} onPhoto={onPhoto} stays={stays} />}
      </div>
    </div>
  )

  // With photos: the photos fill the whole card and the text sits on them, white on a dark fade at the bottom
  if (photos.length) {
    return (
      <li>
        <article className="relative isolate flex h-80 flex-col justify-end overflow-hidden rounded-xl bg-roche shadow-card">
          <PhotoCarousel images={photos} credits={s.imageCredits} label={name} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/85 via-black/45 to-transparent" />
          <div className="relative flex flex-col gap-3 p-4 text-white">
            <div className="flex flex-col gap-0.5">
              {s.title && <span className="text-xs font-bold tracking-wider text-white/80 uppercase">{platformName(s)}</span>}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-bold text-white hover:text-white hover:underline">{name}</a>
              {details && <span className="text-sm text-white/85">{details}</span>}
            </div>
            {nights}
            {controls}
          </div>
        </article>
      </li>
    )
  }

  return (
    <li>
      <Card className={cn('flex h-full flex-col gap-3', !s.title && 'border border-dashed border-line-strong shadow-none')}>
        <div className="flex flex-col gap-1">
          {/* Without a title the name already is the platform, so it is not written twice */}
          {s.title && <span className="text-xs font-bold tracking-wider text-muted uppercase">{platformName(s)}</span>}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-roche hover:text-sommet">{name}</a>
          {details && <span className="text-sm text-muted">{details}</span>}
          {!s.complete && <span className="text-sm text-muted">The site did not share all details. You can add them later.</span>}
        </div>
        <div className="mt-auto flex flex-col gap-3">
          {nights}
          {controls}
        </div>
      </Card>
    </li>
  )
}

// Area, Remove and Like under a stay; light versions when they sit on its photos
function StayControls({ stay: s, areas, me, canRemove, stays, name, onPhoto }: {
  stay: Stay; areas: Area[]; me?: string; canRemove: boolean; stays: TripStays; name: string; onPhoto: boolean
}) {
  const liked = !!me && s.likeUserIds.includes(me)
  const likes = s.likeUserIds.length
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Area for {name}</span>
        <select
          value={s.areaId ?? ''}
          onChange={e => stays.move(s._id, e.target.value || null)}
          className={cn(
            'min-h-10 rounded-md px-2.5 text-sm',
            onPhoto ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm [&>option]:text-roche' : 'border border-line-strong bg-white text-roche',
          )}
        >
          <option value="">No area</option>
          {areas.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        {canRemove && (
          <button
            type="button"
            onClick={() => stays.remove(s._id)}
            aria-label={`Remove ${name}`}
            className={cn('min-h-10 px-2 text-sm font-semibold', onPhoto ? 'text-white/80 hover:text-white' : 'text-muted hover:text-danger')}
          >
            Remove
          </button>
        )}
        <button
          type="button"
          aria-pressed={liked}
          aria-label={`${liked ? 'Liked by you' : 'Like'}, ${likes} ${likes === 1 ? 'like' : 'likes'}`}
          onClick={() => stays.like(s._id)}
          className={cn(
            'flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-bold',
            liked ? 'bg-[#FDE7E1] text-[#9A2E14]'
              : onPhoto ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25'
              : 'border border-line-strong bg-white text-subtle hover:bg-canvas',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
          </svg>
          {likes}
        </button>
      </div>
    </div>
  )
}

type TripDays = { start: string; end: string }

// A run of nights written like the nights on a card, check-in to check-out: "13 – 15 Jun (2 nights)"
const runText = (r: DayRange) => {
  const n = { checkIn: r.first, checkOut: addDays(r.last, 1) }
  return `${nightsRange(n)} (${nightsWord(nightCount(n))})`
}

// The trip's nights as a row of small blocks: dark when a booked stay covers the night, amber when two do,
// empty when none does. Under it the nights still without a stay, so nobody arrives somewhere with no bed.
function NightsBar({ tripDays, stays }: { tripDays: TripDays; stays: Stay[] }) {
  const cover = nightsCover(tripDays, stays)
  const total = cover.nights.length
  if (total === 0) return null
  const done = cover.gaps.length === 0
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold">Nights booked</span>
        <span className={cn('text-sm font-bold', done ? 'text-success' : 'text-muted')}>{cover.booked} of {total}</span>
      </div>
      <ol aria-label="Nights of the trip" className="flex gap-1">
        {cover.nights.map(n => {
          const state = n.stayIds.length > 1 ? 'booked twice' : n.stayIds.length ? 'booked' : 'no stay'
          return (
            <li
              key={n.day}
              title={`${shortDayText(n.day)}: ${state}`}
              aria-label={`Night of ${shortDayText(n.day)}: ${state}`}
              className={cn('h-2.5 flex-1 rounded-full', n.stayIds.length > 1 ? 'bg-chemin' : n.stayIds.length ? 'bg-sommet' : 'bg-line')}
            />
          )
        })}
      </ol>
      {done && cover.doubles.length === 0 && <p className="text-sm font-semibold text-success">Every night has a stay.</p>}
      {(!done || cover.doubles.length > 0) && (
        <div role="status" className="flex flex-col gap-1 rounded-lg border border-chemin-line bg-chemin-light px-3 py-2 text-sm text-chemin-dark">
          {!done && <p><strong>No stay booked</strong> for {cover.gaps.map(runText).join(', ')}.</p>}
          {cover.doubles.length > 0 && <p><strong>Two stays booked</strong> for {cover.doubles.map(runText).join(', ')}.</p>}
        </div>
      )}
    </div>
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
        'flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-bold whitespace-nowrap disabled:opacity-60',
        s.booked ? 'bg-success text-white hover:bg-success/90'
          : onPhoto ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25'
          : 'border border-line-strong bg-white text-subtle hover:bg-canvas',
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
        'flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold',
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
