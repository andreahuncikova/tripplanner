import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TripSummary } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { cn } from '../lib/cn'
import { STEPS, countdown, people, phases, tripDates } from '../lib/trips'
import { Avatar, AvatarGroup, Button, Modal } from '../components/ui'
import { JoinTripForm } from './JoinTrip'
import { InstallBanner } from '../components/InstallBanner'

// Link that looks like a button (Button itself is a <button>, these go to another page)
const primaryLink = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-sommet px-5 font-bold text-white hover:bg-sommet-dark hover:text-white'
const secondaryLink = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-white px-5 font-semibold text-roche hover:bg-canvas hover:text-roche'

// Placeholder colours for the cover of a trip card until trips have photos
const covers = ['bg-ciel', 'bg-chemin-light', 'bg-sky']
const cover = (code: string) => covers[code.charCodeAt(0) % covers.length]

// "My trips" from the mockups: trips still being planned, trips with confirmed dates, or the empty state.
// "Join with code" opens its own page on phones and a window on desktop.
export default function Dashboard() {
  const { user, logout } = useAuth()
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [joinOpen, setJoinOpen] = useState(false)

  useEffect(() => {
    setError('')
    api<{ groups: TripSummary[] }>('/api/groups')
      .then(r => setTrips(r.groups))
      .catch(err => setError((err as Error).message))
  }, [reload])

  const firstName = user?.username.split(' ')[0] ?? ''
  const planning = trips?.filter(t => t.phase !== 'done') ?? []
  const ready = trips?.filter(t => t.phase === 'done') ?? []
  const empty = trips !== null && trips.length === 0

  // Phones get a link to the /join page, desktop a button that opens the window.
  // max-lg:hidden (not plain "hidden"), because the button styles already contain inline-flex,
  // and a plain hidden would lose against it and show both buttons on phones.
  const joinButton = (className: string) => (
    <>
      <Link to="/join" className={cn(className, 'lg:hidden')}>Join with code</Link>
      <button type="button" onClick={() => setJoinOpen(true)} className={cn(className, 'cursor-pointer max-lg:hidden')}>Join with code</button>
    </>
  )

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 bg-white px-5 pt-6 pb-5 lg:items-end lg:bg-transparent lg:px-12 lg:pt-10 lg:pb-0">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted lg:text-base">Hi, {firstName}</span>
          <h1 className="text-heading font-extrabold lg:text-display">Your trips</h1>
        </div>
        <div className="flex items-center gap-3">
          {!empty && (
            <div className="hidden gap-3 lg:flex">
              {joinButton(secondaryLink)}
              <Link to="/new-trip" className={primaryLink}>+ New trip</Link>
            </div>
          )}
          {/* Until the profile page exists, log-out lives here */}
          <Button variant="link" size="sm" onClick={logout}>Log out</Button>
          {user && <Avatar name={user.username} color={user.color} size="lg" className="lg:hidden" />}
        </div>
      </header>

      {!empty && trips !== null && (
        <div className="flex gap-3 border-b border-line bg-white px-5 py-4 lg:hidden">
          <Link to="/new-trip" className={cn(primaryLink, 'flex-1')}>+ New trip</Link>
          {joinButton(cn(secondaryLink, 'flex-1'))}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-3.5 p-5 lg:gap-5 lg:px-12 lg:py-7">
        <InstallBanner />
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">
            Your trips could not be loaded: {error}
            <Button variant="secondary" size="sm" onClick={() => setReload(r => r + 1)}>Try again</Button>
          </div>
        )}
        {trips === null && !error && <p className="text-muted" role="status">Loading your trips…</p>}

        {empty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4.5 text-center lg:mx-auto lg:max-w-[560px]">
            <div aria-hidden="true" className="flex size-28 items-center justify-center rounded-[32px] bg-ciel-light lg:size-33 lg:rounded-[36px]">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="stroke-sommet" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
            </div>
            <h2 className="font-display text-heading font-extrabold tracking-[-0.02em] lg:text-[40px] lg:tracking-[-0.03em]">No trips yet</h2>
            <p className="max-w-[290px] text-base/normal text-subtle lg:max-w-none lg:text-lg/normal">
              Start a trip and invite your friends, or join one with the code a friend sent you.
            </p>
            <div className="flex w-full flex-col gap-2.5 pt-1.5 lg:w-auto lg:flex-row lg:gap-3">
              <Link to="/new-trip" className={cn(primaryLink, 'rounded-full lg:px-6')}>+ New trip</Link>
              {joinButton(cn(secondaryLink, 'rounded-full font-bold lg:px-5.5'))}
            </div>
            <ol aria-label="How it works" className="mt-4.5 hidden flex-wrap justify-center gap-3 lg:flex">
              {['Invite friends', 'Decide together', 'Go and split costs'].map((step, i) => (
                <li key={step} className="rounded-[14px] bg-white px-4 py-3 text-sm"><strong className="text-sommet">{i + 1}</strong> {step}</li>
              ))}
            </ol>
          </div>
        )}

        {planning.length > 0 && <TripSection title="Planning now" trips={planning} />}
        {ready.length > 0 && <TripSection title="Ready to go" trips={ready} />}
      </main>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a trip" description="Enter the code from the invite your friend sent.">
        {/* Mounted only while open, so the window starts empty every time */}
        {joinOpen && <JoinTripForm />}
      </Modal>
    </div>
  )
}

function TripSection({ title, trips }: { title: string; trips: TripSummary[] }) {
  return (
    <section className="flex flex-col gap-3.5 lg:gap-5">
      <h2 className="text-caption font-bold tracking-[0.08em] text-muted uppercase">{title}</h2>
      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] lg:gap-5">
        {trips.map(t => <TripCard key={t.inviteCode} trip={t} />)}
      </div>
    </section>
  )
}

function TripCard({ trip }: { trip: TripSummary }) {
  const phase = phases[trip.phase]
  const done = trip.phase === 'done'
  const chip = (
    <span className={cn('rounded-full px-2.5 py-1.5 text-xs font-bold', done ? 'bg-white text-roche lg:bg-white' : 'bg-ciel-light text-sommet lg:bg-white')}>
      {phase.label}
    </span>
  )

  return (
    <Link
      to={`/trips/${trip.inviteCode}`}
      className="flex flex-col overflow-hidden rounded-xl bg-white text-roche shadow-card hover:text-roche hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sommet"
    >
      <div className={cn('relative hidden h-35 lg:block', cover(trip.inviteCode))}>
        <span className="absolute top-3.5 left-3.5">{chip}</span>
      </div>
      <div className="flex flex-col gap-3.5 p-4.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <strong className="truncate text-lg">{trip.name}</strong>
            <span className="text-sm text-muted">{tripDates(trip)} · {people(trip.members.length)}</span>
          </div>
          <span className="shrink-0 lg:hidden">{chip}</span>
        </div>
        <div role="img" aria-label={`Step ${phase.step} of ${STEPS}`} className="flex gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < phase.step ? 'bg-sommet' : 'bg-line')} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <AvatarGroup people={trip.members.map(m => ({ name: m.username, color: m.color }))} max={3} />
          {done && <span className="text-caption font-bold text-sommet">{countdown(trip)}</span>}
        </div>
      </div>
    </Link>
  )
}
