import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Member, TripChangesInput, TripSummary } from '@shared/types'
import { useAuth } from '../../auth/useAuth'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useCurrencies } from '../../lib/currencies'
import { TRIPS_CHANGED, people, tripDates } from '../../lib/trips'
import { Avatar, Button, Input, Modal, useToast } from '../../components/ui'
import { BackIcon } from '../../components/layout/icons'
import InviteModal from './InviteModal'
import { useTripSummary } from './useTripSummary'

type Dialog = 'name' | 'dates' | 'currency' | 'invite' | 'leave' | 'delete'

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// "YYYY-MM-DD" plus some days, counted at noon so the time zone cannot move it to another day
const addDays = (key: string, days: number) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + days); return dayKey(d) }
const joined = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

// "Trip settings" from the mockups. Everyone sees the trip and its members and can leave;
// only the organiser changes the name, the currency and known dates, and deletes the trip.
// Leave and Delete were hidden behind the Invite button in the old app.
export default function TripSettings() {
  const { tripId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { trip, reload } = useTripSummary(tripId)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  if (!trip) return null

  const isOrganiser = trip.adminUserId === user?._id
  // Dates the group voted on come from the Plan tab; dates entered when the trip was created can be changed here
  const canEditDates = isOrganiser && trip.datesKnown
  const next = trip.members.find(m => m.userId !== user?._id)

  async function save(changes: TripChangesInput) {
    await api(`/api/groups/${tripId}`, { method: 'PATCH', body: JSON.stringify(changes) })
    reload()
    window.dispatchEvent(new Event(TRIPS_CHANGED))
    toast('Saved')
    close()
  }

  async function leave() {
    await api(`/api/groups/${tripId}/leave`, { method: 'POST' })
    toast(`You left ${trip!.name}`)
    navigate('/dashboard', { replace: true })
  }

  async function remove() {
    await api(`/api/groups/${tripId}`, { method: 'DELETE' })
    toast('Trip deleted')
    navigate('/dashboard', { replace: true })
  }

  const deleteNote = isOrganiser ? 'Deleting removes the trip for everyone.' : 'Only the organiser can delete the trip.'

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:min-h-0 lg:flex-1 lg:gap-6 lg:px-12 lg:py-9">
      {/* Phones: back to the trip and the title. Desktop: "Trip name / Trip settings" */}
      <header className="flex items-center gap-1 bg-white px-3 pt-3 pb-3 lg:gap-2 lg:bg-transparent lg:p-0">
        <Link to={`/trips/${tripId}`} aria-label={`Back to ${trip.name}`} className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
          <BackIcon />
        </Link>
        <Link to={`/trips/${tripId}`} className="hidden max-w-80 truncate font-semibold text-subtle no-underline hover:text-roche lg:inline">{trip.name}</Link>
        <span aria-hidden="true" className="hidden text-faint lg:inline">/</span>
        <h1 className="text-xl font-extrabold lg:text-heading">Trip settings</h1>
      </header>

      {/* Phones: Trip, Members, then Leave and Delete at the bottom. Desktop: Trip and Leave/Delete on the left, Members on the right */}
      <div className="flex flex-1 flex-col gap-5 p-5 lg:grid lg:flex-none lg:grid-cols-2 lg:items-start lg:gap-6 lg:p-0">
        <Section title="Trip">
          <Row label="Name" value={trip.name} onEdit={isOrganiser ? () => setDialog('name') : undefined} />
          <Row label="Dates" value={tripDates(trip)} onEdit={canEditDates ? () => setDialog('dates') : undefined} />
          <Row label="Currency" value={trip.currency} onEdit={isOrganiser ? () => setDialog('currency') : undefined} />
        </Section>

        <Section
          title={`Members · ${trip.members.length}`}
          action={<button type="button" onClick={() => setDialog('invite')} className="py-2 text-sm font-bold text-sommet hover:text-sommet-dark">+ Invite</button>}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {trip.members.map(m => (
            <MemberRow key={m.userId} member={m} you={m.userId === user?._id} organiser={m.userId === trip.adminUserId} />
          ))}
        </Section>

        <section aria-label="Leave or delete" className="mt-auto flex flex-col gap-2.5 lg:col-start-1 lg:row-start-2 lg:mt-0 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3 lg:rounded-xl lg:bg-white lg:p-5">
          <div className="hidden lg:flex lg:basis-full lg:flex-col lg:gap-0.5">
            <strong>Leave or delete</strong>
            <span className="text-sm text-muted">{deleteNote}</span>
          </div>
          <Button variant="secondary" fullWidth onClick={() => setDialog('leave')} className="lg:w-auto">Leave trip</Button>
          {isOrganiser && (
            <Button variant="dangerOutline" fullWidth onClick={() => setDialog('delete')} className="lg:w-auto">
              <span className="lg:hidden">Delete trip for everyone</span><span className="hidden lg:inline">Delete trip</span>
            </Button>
          )}
          <span className="text-center text-caption text-muted lg:hidden">{deleteNote}</span>
        </section>
      </div>

      <InviteModal open={dialog === 'invite'} onClose={close} trip={trip} settingsLink={false} />

      {/* Each form is only rendered while it is open, so it starts from the current values every time */}
      <Modal open={dialog === 'name'} onClose={close} title="Trip name">
        {dialog === 'name' && (
          <EditForm onSave={form => save({ name: String(form.get('name')) })}>
            <Input label="Trip name" name="name" defaultValue={trip.name} required maxLength={60} autoComplete="off" />
          </EditForm>
        )}
      </Modal>
      <Modal open={dialog === 'currency'} onClose={close} title="Group currency" description="New expenses use it, and the budget shows the totals in it.">
        {dialog === 'currency' && <CurrencyForm current={trip.currency} onSave={currency => save({ currency })} />}
      </Modal>
      <Modal open={dialog === 'dates'} onClose={close} title="Trip dates">
        {dialog === 'dates' && <DatesForm trip={trip} onSave={dates => save({ dates })} />}
      </Modal>

      <Confirm
        open={dialog === 'leave'}
        onClose={close}
        title={`Leave ${trip.name}?`}
        text={
          !next ? 'You are the only member, so the trip and everything in it will be deleted.'
          : isOrganiser ? `${next.username} becomes the organiser. Your votes are removed, but the expenses you added stay.`
          : 'Your votes are removed, but the expenses you added stay. You can join again with the invite link.'
        }
        confirm="Leave trip"
        onConfirm={leave}
      />
      <Confirm
        open={dialog === 'delete'}
        onClose={close}
        title="Delete the trip for everyone?"
        text={`${trip.name} and all its plans, votes, expenses and messages are deleted for all ${people(trip.members.length)}. This cannot be undone.`}
        confirm="Delete trip"
        onConfirm={remove}
      />
    </div>
  )
}

// A group of rows with a small heading. Phones: the heading above a white box. Desktop: one white card.
function Section({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('flex flex-col gap-2 lg:gap-0 lg:rounded-xl lg:bg-white lg:py-2', className)}>
      <div className="flex items-center justify-between px-1 lg:px-5 lg:pt-2.5 lg:pb-1.5">
        <h2 className="text-caption font-bold tracking-widest text-muted uppercase">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col rounded-lg bg-white">{children}</div>
    </section>
  )
}

const rowClass = 'flex w-full items-center justify-between gap-4 border-b border-line px-4 py-4 text-left last:border-b-0 lg:px-5'

// One setting. Without onEdit (a member, or dates the group voted on) it only shows the value.
function Row({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  if (!onEdit) {
    return (
      <div className={rowClass}>
        <span>{label}</span>
        <span className="truncate text-muted">{value}</span>
      </div>
    )
  }
  return (
    <button type="button" onClick={onEdit} aria-label={`Change the ${label.toLowerCase()} (${value})`} className={cn(rowClass, 'hover:bg-canvas')}>
      <span>{label}</span>
      <span className="truncate text-muted">
        {value}<span className="lg:hidden"> ›</span><span className="hidden lg:inline"> · Edit</span>
      </span>
    </button>
  )
}

function MemberRow({ member, you, organiser }: { member: Member; you: boolean; organiser: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 lg:px-5">
      <Avatar name={member.username} color={member.color} />
      <span className="min-w-0 flex-1 truncate">{member.username}{you && ' (you)'}</span>
      {organiser
        ? <span className="rounded-full bg-ciel-light px-2.25 py-1.25 text-xs font-bold text-sommet">Organiser</span>
        : member.joinedAt && <span className="hidden text-caption text-muted lg:inline">Joined {joined.format(new Date(member.joinedAt))}</span>}
    </div>
  )
}

// The form inside an edit dialog: its fields, an error from the server and Save
function EditForm({ onSave, children }: { onSave: (form: FormData) => Promise<void>; children: ReactNode }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave(new FormData(e.currentTarget))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {children}
      {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}

function CurrencyForm({ current, onSave }: { current: string; onSave: (currency: string) => Promise<void> }) {
  const currencies = useCurrencies()
  return (
    <EditForm onSave={form => onSave(String(form.get('currency')))}>
      <div className="flex flex-col gap-2">
        <label htmlFor="settings-currency" className="text-sm font-bold">Group currency</label>
        <select id="settings-currency" name="currency" defaultValue={current} className="rounded-md border border-line-strong bg-white px-4 py-3.5 text-base text-roche focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none">
          {currencies.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </div>
    </EditForm>
  )
}

function DatesForm({ trip, onSave }: { trip: TripSummary; onSave: (dates: { start: string; end: string }) => Promise<void> }) {
  const today = dayKey(new Date())
  const [start, setStart] = useState(trip.finalDate ?? '')
  const [end, setEnd] = useState(trip.finalDate && trip.tripDuration ? addDays(trip.finalDate, trip.tripDuration - 1) : '')
  return (
    <EditForm onSave={() => onSave({ start, end })}>
      <div className="flex gap-2.5">
        <div className="min-w-0 flex-1">
          <Input label="From" type="date" required value={start} min={today} onChange={e => { setStart(e.target.value); if (end && end < e.target.value) setEnd('') }} />
        </div>
        <div className="min-w-0 flex-1">
          <Input label="To" type="date" required value={end} min={start || today} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
    </EditForm>
  )
}

// "Are you sure?" before leaving or deleting, with the server's error if it fails
function Confirm({ open, onClose, title, text, confirm, onConfirm }: {
  open: boolean; onClose: () => void; title: string; text: string; confirm: string; onConfirm: () => Promise<void>
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setError('')
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={text}>
      {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={run} disabled={busy}>{busy ? 'One moment…' : confirm}</Button>
      </div>
    </Modal>
  )
}
