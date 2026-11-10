import { useState, type FormEvent } from 'react'
import type { Area, Stay, TripSummary } from '@shared/types'
import { formatPrice, platformName } from './stayFormat'
import { useAuth } from '../../auth/useAuth'
import { Button, Card, Input, Modal } from '../../components/ui'
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

  return (
    <section aria-labelledby="stays-title" className="flex flex-col gap-4">
      <h2 id="stays-title" className="text-2xl font-extrabold">Stays</h2>

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
            />
          ))}
        </ul>
      )}

      <AreasModal open={areasOpen} onClose={() => setAreasOpen(false)} stays={stays} onAdded={setAreaId} />
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

function StayItem({ stay: s, areas, me, canRemove, stays }: {
  stay: Stay; areas: Area[]; me?: string; canRemove: boolean; stays: TripStays
}) {
  const liked = !!me && s.likeUserIds.includes(me)
  const likes = s.likeUserIds.length
  const name = s.title ?? platformName(s)
  const details = [s.location, s.price && formatPrice(s.price)].filter(Boolean).join(' · ')

  return (
    <li>
      <Card flush className={cn('flex h-full flex-col', !s.complete && !s.title && 'border border-dashed border-line-strong shadow-none')}>
        {s.image && <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-36 w-full object-cover" />}
        <div className="flex flex-1 flex-col gap-3 p-4.5">
        <div className="flex flex-col gap-1">
          {/* Without a title the name already is the platform, so it is not written twice */}
          {s.title && <span className="text-xs font-bold tracking-wider text-muted uppercase">{platformName(s)}</span>}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-roche hover:text-sommet">{name}</a>
          {details && <span className="text-sm text-muted">{details}</span>}
          {!s.complete && <span className="text-sm text-muted">The site did not share all details. You can add them later.</span>}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-subtle">
            <span className="sr-only">Area for {name}</span>
            <select
              value={s.areaId ?? ''}
              onChange={e => stays.move(s._id, e.target.value || null)}
              className="min-h-10 rounded-md border border-line-strong bg-white px-2.5 text-sm text-roche"
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
                className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-danger"
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
                liked ? 'bg-[#FDE7E1] text-[#9A2E14]' : 'border border-line-strong bg-white text-subtle hover:bg-canvas',
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
              </svg>
              {likes}
            </button>
          </div>
        </div>
        </div>
      </Card>
    </li>
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
