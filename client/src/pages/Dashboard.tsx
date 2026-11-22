import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TripSummary } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { cn } from '../lib/cn'
import { PLAN_STEPS, currentStep } from '../lib/plan'
import { countdown, phases, tripDates } from '../lib/trips'
import { Avatar, AvatarGroup, Button, Modal } from '../components/ui'
import { JoinTripForm } from './JoinTrip'
import { InstallBanner } from '../components/InstallBanner'
import { LogOutIcon, PlusIcon, TicketIcon } from '../components/layout/icons'

// Link that looks like a button (Button itself is a <button>, these go to another page)
const primaryLink = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-sommet px-5 font-bold lg:min-h-10 lg:rounded-md lg:px-4 lg:text-md text-white hover:bg-sommet-dark hover:text-white [&_svg]:size-4.5'
const secondaryLink = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-white px-5 font-semibold lg:min-h-10 lg:rounded-md lg:px-4 lg:text-md text-roche hover:bg-canvas hover:text-roche [&_svg]:size-4.5 [&_svg]:text-sommet'
// The desktop actions sit in one dark box, like the section switch in a trip
const toolbarBase = 'inline-flex h-full items-center gap-2 rounded-sm px-3.5 text-sm whitespace-nowrap [&_svg]:size-4'
const toolbarItem = `${toolbarBase} font-medium text-white/80 hover:bg-white/10 hover:text-white [&_svg]:text-ciel`
const toolbarPrimary = `${toolbarBase} bg-white font-semibold text-roche hover:bg-ciel-light hover:text-roche [&_svg]:text-sommet`

// The background of a trip card without a photo (no destination yet, or no photo found); the same trip always gets the same one
const backgrounds = ['from-sommet to-roche', 'from-[#3d6b7a] to-roche', 'from-chemin-dark to-roche']
const background = (code: string) => backgrounds[code.charCodeAt(0) % backgrounds.length]

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
      <Link to="/join" className={cn(className, 'lg:hidden')}><TicketIcon />Join with code</Link>
      <button type="button" onClick={() => setJoinOpen(true)} className={cn(className, 'cursor-pointer max-lg:hidden')}><TicketIcon />Join with code</button>
    </>
  )

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 bg-white px-6 pt-6 pb-5 lg:items-end lg:bg-transparent lg:px-12 lg:pt-10 lg:pb-0 xl:px-16">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted lg:text-base">Hi, {firstName}</span>
          <h1 className="text-heading font-extrabold lg:text-display">Your trips</h1>
        </div>
        {/* Desktop: Join, New trip and Log out in one dark box. Phones: the avatar and Log out as an icon;
            Join and New trip are in their own row under the header. Until the profile page exists, log-out lives here. */}
        <div className="flex items-center gap-2">
          <div className="hidden h-11 items-center gap-1 rounded-md bg-roche p-1 shadow-raised lg:flex">
            {!empty && (
              <>
                {joinButton(toolbarItem)}
                <Link to="/new-trip" className={toolbarPrimary}><PlusIcon />New trip</Link>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
              </>
            )}
            <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="flex size-9 items-center justify-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white">
              <LogOutIcon />
            </button>
          </div>
          <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="flex size-11 items-center justify-center rounded-full text-subtle hover:bg-canvas hover:text-roche lg:hidden">
            <LogOutIcon />
          </button>
          {user && <Avatar name={user.username} color={user.color} size="lg" className="lg:hidden" />}
        </div>
      </header>

      {!empty && trips !== null && (
        <div className="flex gap-3 border-b border-line bg-white px-6 py-4 lg:hidden">
          <Link to="/new-trip" className={cn(primaryLink.replace('px-5', 'px-3'), 'flex-1 whitespace-nowrap')}><PlusIcon />New trip</Link>
          {joinButton(cn(secondaryLink.replace('px-5', 'px-3'), 'flex-1 whitespace-nowrap'))}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-3.5 px-6 py-5 lg:gap-5 lg:px-12 lg:py-7 xl:px-16">
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
              <Link to="/new-trip" className={cn(primaryLink, 'rounded-full lg:px-6')}><PlusIcon />New trip</Link>
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
        {/* The dates are agreed; such a trip can still be choosing its stays, so it is not called "Ready to go" here */}
        {ready.length > 0 && <TripSection title="Dates confirmed" trips={ready} />}
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
      {/* Portrait photos: two next to each other on phones, as many as fit on a computer */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] lg:gap-x-5 lg:gap-y-6">
        {trips.map(t => <TripCard key={t.inviteCode} trip={t} />)}
      </div>
    </section>
  )
}

// A trip as a portrait photo: the destination fills the card, with how far the planning is at the top, and the name,
// the place, the dates, the people and the planning steps on a dark fade at the bottom. Unsplash asks for the
// photographer to be named with a link, so a small credit sits at the bottom of the photo.
function TripCard({ trip }: { trip: TripSummary }) {
  const step = currentStep(trip.phase)
  const ready = step === PLAN_STEPS.length
  const soon = trip.phase === 'done' ? countdown(trip) : null
  const place = trip.approvedDest ?? 'Where to?'

  return (
    <div className="relative min-w-0">
      <Link
        to={`/trips/${trip.inviteCode}`}
        className={cn(
          'group relative isolate flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-xl bg-linear-to-br text-white shadow-card',
          'hover:text-white hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sommet',
          background(trip.inviteCode),
        )}
      >
        {trip.cover ? (
          <img src={trip.cover.url} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          // Without a photo the place (or the question) is written large in the middle
          <span aria-hidden="true" className="absolute inset-x-3 top-[36%] -z-10 -translate-y-1/2 text-center font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-white/25 lg:text-3xl">
            {place}
          </span>
        )}
        <span aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-20 bg-linear-to-b from-black/35 to-transparent" />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-3/5 bg-linear-to-t from-black/85 via-black/45 to-transparent" />

        <div className="flex p-2.5 lg:p-3.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-2xs font-bold text-roche backdrop-blur-sm lg:text-xs">
            {phases[trip.phase].label}
          </span>
        </div>

        <div className={cn('flex flex-col gap-2 p-3 lg:gap-2.5 lg:p-4', trip.cover && 'pb-6 lg:pb-7')}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="line-clamp-2 text-[15px] leading-tight lg:text-lg">{trip.name}</strong>
            <span className="truncate text-xs text-white/80 lg:text-sm">{place} · {tripDates(trip)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <AvatarGroup people={trip.members.map(m => ({ name: m.username, color: m.color }))} max={3} />
            {soon && <span className="truncate text-xs font-bold text-chemin lg:text-caption">{soon}</span>}
          </div>
          <div role="img" aria-label={ready ? 'All planning steps done' : `Step ${step + 1} of ${PLAN_STEPS.length}: ${PLAN_STEPS[step]}`} className="flex gap-1">
            {PLAN_STEPS.map((name, i) => (
              <span key={name} className={cn('h-1 flex-1 rounded-full', i < step ? 'bg-chemin' : i === step ? 'bg-white' : 'bg-white/25')} />
            ))}
          </div>
        </div>
      </Link>
      {/* Unsplash's rules ask to name the photographer and Unsplash with links, so the credit stays, small and faint,
          at the bottom of the photo. It sits on top of the card, outside its link, because a link cannot hold links. */}
      {trip.cover && (
        <p className="absolute inset-x-3 bottom-1.5 truncate text-[10px] text-white/45 lg:inset-x-4 lg:bottom-2">
          <a href={trip.cover.authorUrl} target="_blank" rel="noopener noreferrer" className="text-white/45 hover:text-white">{trip.cover.author}</a>
          {' / '}<a href="https://unsplash.com/?utm_source=tripplanner&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="text-white/45 hover:text-white">Unsplash</a>
        </p>
      )}
    </div>
  )
}
