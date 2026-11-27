import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { TripSummary } from '@shared/types'
import { useAuth } from '../../auth/useAuth'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { TRIPS_CHANGED, tripDates } from '../../lib/trips'
import { Avatar } from '../ui'
import { AllTripsIcon, Logo, PanelIcon, PlusIcon } from './icons'

// A small tile with the trip's first letter. Planning steps get the accent colours, finished trips grey,
// as the dots did in the desktop mockups.
const tile = (phase: TripSummary['phase']) => phase === 'done' ? 'bg-line text-subtle'
  : phase === 'destinations' ? 'bg-chemin text-roche' : 'bg-ciel text-roche'

// Remembered in the browser, so the sidebar stays as the user left it
const KEY = 'tp_sidebar_collapsed'

// The left column on desktop: the user's trips and their profile. Hidden on phones.
// It folds into a narrow bar of icons, which gives the page more room.
export function Sidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === '1')

  function toggle() {
    setCollapsed(c => {
      localStorage.setItem(KEY, c ? '0' : '1')
      return !c
    })
  }

  // Loaded again on every page change, so a trip the user just joined or created shows up right away,
  // and after a change in Trip settings (e.g. a new name), which stays on the same page
  useEffect(() => {
    const load = () => api<{ groups: TripSummary[] }>('/api/groups')
      .then(r => setTrips(r.groups))
      .catch(() => setTrips([]))
    load()
    window.addEventListener(TRIPS_CHANGED, load)
    return () => window.removeEventListener(TRIPS_CHANGED, load)
  }, [pathname])

  const item = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
    collapsed ? 'justify-center px-2' : 'px-2.5',
    isActive ? 'bg-canvas font-semibold text-roche' : 'font-medium text-subtle hover:bg-canvas hover:text-roche',
  )
  // The label of an item: hidden when folded, but still read out and shown as a tooltip
  const label = (text: string) => <span className={cn('truncate', collapsed && 'sr-only')}>{text}</span>

  return (
    <aside className={cn(
      // A white panel that floats on the grey page: away from the edges and with slightly round corners
      'sticky top-3 m-3 mr-0 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col gap-7 rounded-lg bg-white py-5 shadow-card text-roche transition-[width] duration-200 lg:flex',
      collapsed ? 'w-17 px-2.5' : 'w-64 px-3',
    )}>
      <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-4')}>
        <Link to="/dashboard" aria-label="TripPlanner, all trips" className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 text-lg font-extrabold text-roche hover:text-roche">
          <Logo size={28} />{!collapsed && 'TripPlanner'}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Open the sidebar' : 'Close the sidebar'}
          title={collapsed ? 'Open the sidebar' : 'Close the sidebar'}
          aria-expanded={!collapsed}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-roche"
        >
          <PanelIcon />
        </button>
      </div>

      <nav aria-label="Your trips" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        <NavLink to="/dashboard" end className={item} title={collapsed ? 'All trips' : undefined}>
          <span className="flex size-6 shrink-0 items-center justify-center"><AllTripsIcon /></span>{label('All trips')}
        </NavLink>
        {collapsed
          ? <span aria-hidden="true" className="mx-2 my-3 border-t border-line" />
          : <span className="px-2.5 pt-5 pb-1.5 text-2xs font-bold tracking-wider text-muted uppercase">Your trips</span>}
        {trips.map(t => (
          <NavLink key={t.inviteCode} to={`/trips/${t.inviteCode}`} className={item} title={collapsed ? t.name : undefined}>
            {({ isActive }) => (
              <>
                <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold', tile(t.phase))}>
                  {t.name.charAt(0).toUpperCase()}
                </span>
                {/* The open trip also says where and when; the top bar on desktop does not repeat it */}
                {isActive && !collapsed ? (
                  <span className="flex min-w-0 flex-col leading-snug">
                    <span className="truncate">{t.name}</span>
                    <span className="truncate text-xs font-semibold text-muted">{[t.approvedDest, tripDates(t)].filter(Boolean).join(' · ')}</span>
                  </span>
                ) : label(t.name)}
              </>
            )}
          </NavLink>
        ))}
        <Link
          to="/new-trip"
          title={collapsed ? 'New trip' : undefined}
          className={cn('flex items-center gap-2.5 rounded-lg py-2 text-sm font-semibold text-muted hover:bg-canvas hover:text-roche', collapsed ? 'justify-center px-2' : 'px-2.5')}
        >
          <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong"><PlusIcon /></span>
          {label('New trip')}
        </Link>
      </nav>

      {user && (
        <div className="mt-auto border-t border-line pt-3">
        <NavLink
          to="/profile"
          title={collapsed ? 'Profile and payments' : undefined}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 rounded-lg py-2 text-roche hover:bg-canvas hover:text-roche',
            collapsed ? 'justify-center' : 'px-2.5',
            isActive && 'bg-canvas',
          )}
        >
          <Avatar name={user.username} color={user.color} photo={user.photo} size="sm" />
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <strong className="truncate text-sm">{user.username}</strong>
              <span className="text-xs text-muted">Profile and payments</span>
            </span>
          )}
        </NavLink>
        </div>
      )}
    </aside>
  )
}
