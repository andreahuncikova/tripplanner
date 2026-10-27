import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { TripSummary } from '@shared/types'
import { useAuth } from '../../auth/useAuth'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { Avatar } from '../ui'
import { AllTripsIcon, Logo } from './icons'

const item = ({ isActive }: { isActive: boolean }) => cn(
  'flex items-center gap-2.5 rounded-[10px] p-2.5',
  isActive ? 'bg-ciel-light font-bold text-sommet' : 'font-semibold text-roche hover:bg-canvas hover:text-roche',
)

// Planning steps get the accent colour, finished trips grey, as in the desktop mockups.
const dot = (phase: TripSummary['phase']) => phase === 'done' ? 'bg-faint' : phase === 'destinations' ? 'bg-chemin' : 'bg-sommet'

// The left column on desktop: the user's trips and their profile. Hidden on phones.
export function Sidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [trips, setTrips] = useState<TripSummary[]>([])

  // Loaded again on every page change, so a trip the user just joined or created shows up right away
  useEffect(() => {
    api<{ groups: TripSummary[] }>('/api/groups')
      .then(r => setTrips(r.groups))
      .catch(() => setTrips([]))
  }, [pathname])

  return (
    <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col gap-5 border-r border-line bg-white px-4 py-5 lg:flex">
      <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1 text-lg font-extrabold text-roche hover:text-roche">
        <Logo />TripPlanner
      </Link>
      <Link to="/new-trip" className="rounded-md bg-sommet p-3 text-center font-bold text-white hover:bg-sommet-dark hover:text-white">
        + New trip
      </Link>

      <nav aria-label="Your trips" className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        <span className="px-2 pb-1.5 text-xs font-bold tracking-widest text-muted uppercase">Your trips</span>
        <NavLink to="/dashboard" end className={item}><AllTripsIcon />All trips</NavLink>
        {trips.map(t => (
          <NavLink key={t.inviteCode} to={`/trips/${t.inviteCode}`} className={item}>
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', dot(t.phase))} />
            <span className="truncate">{t.name}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="mt-auto flex items-center gap-2.5 rounded-md border border-line p-2.5">
          <Avatar name={user.username} color={user.color} />
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-sm">{user.username}</strong>
            <span className="text-xs text-muted">Profile and payments</span>
          </span>
        </div>
      )}
    </aside>
  )
}
