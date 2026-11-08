import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { InstallButton } from '../components/InstallButton'
import { Logo } from '../components/layout/icons'
import { api } from '../lib/api'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/useMediaQuery'
import { Timeline, TimelineCarousel } from './landing/Timeline'
import { steps } from './landing/steps'
import { useWalkthrough } from './landing/useWalkthrough'

// The first page a visitor sees: a travel photo across the whole page, what TripPlanner does,
// the two ways in, and the six planning steps as stops on a path winding across the photo.
// The baseline opened straight on the log-in form.
export default function Landing() {
  const { user } = useAuth()
  const wide = useMediaQuery('(min-width: 1024px)')
  const walkthrough = useWalkthrough(steps.length)
  // Someone already logged in goes straight to their trips.
  const start = user ? '/dashboard' : '/login?mode=signup'
  // One button for both: signing up and logging in are two tabs of the same page.
  const startLabel = user ? 'Your trips' : 'Get started, log in'

  // Wakes the Render server, which sleeps when nobody uses it, while the visitor reads the page.
  useEffect(() => {
    api('/api/health').catch(() => {})
  }, [])

  const link = 'text-white hover:text-white'
  // A line under the link that draws itself from left to right on hover (and on keyboard focus).
  const underline = 'relative after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100 focus-visible:after:scale-x-100'

  return (
    // Big monitors: the whole page grows (zoom), and its minimum height shrinks by the same factor, so it still fills the window.
    <div className="landing relative isolate flex min-h-[calc(100dvh/var(--z))] flex-col overflow-hidden bg-roche text-white [--z:1] [zoom:var(--z)] min-[1900px]:[--z:1.25] min-[2400px]:[--z:1.5]">
      {/* The photo fills the page; darker at the top so the text reads well, and a little at the bottom. */}
      <img src="/landing-hero.jpg" alt="" className="absolute inset-0 -z-10 size-full object-cover object-[50%_55%]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(35_40_48/0.55)_0%,rgb(35_40_48/0.15)_40%,rgb(35_40_48/0)_65%,rgb(35_40_48/0.35)_100%)]" />

      <header>
        <nav aria-label="Main" className="flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:px-8 md:py-4 xl:px-12">
          <Link to="/" className={`flex items-center gap-2 text-lead font-extrabold ${link}`}>
            <Logo light />TripPlanner
          </Link>
          <div className="flex items-center gap-1 md:gap-2">
            <InstallButton />
            {/* For someone who got an invite from a friend */}
            {!user && <Link to="/join" className={`px-3 py-1.5 text-sm font-semibold md:text-md ${link} ${underline}`}>Join with a code</Link>}
            <StartButton to={start} label={startLabel} className="hidden md:flex" />
          </div>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center px-5 pb-8 md:px-8 lg:pb-6 xl:px-12">
        {/* Centred on every screen; on wide ones above the city, so the path and its steps have the middle of the photo to themselves. */}
        <div className="flex flex-col items-center pt-2 text-center md:pt-6 lg:pt-12">
          <h1 className="font-display text-[31px] leading-[1.1] font-extrabold tracking-[-0.025em] [text-shadow:0_2px_24px_rgb(0_0_0/0.25)] md:text-[42px] lg:text-[40px] lg:whitespace-nowrap">
            Your next trip, <span className="inline-block rounded-[14px] bg-white px-3 pb-1 whitespace-nowrap text-sommet [text-shadow:none] lg:px-3.5">planned together.</span>
          </h1>
          {/* Phones: the header is too narrow for the button, so it sits here. */}
          <StartButton to={start} label={startLabel} className="mt-6 md:hidden" />
        </div>

        {/* The steps: a path across the photo on wide screens, one step at a time on phones and tablets. */}
        {wide
          ? <div className="relative -mx-8 mt-14 max-h-140 min-h-75 flex-1 xl:-mx-12"><Timeline w={walkthrough} /></div>
          : <div className="mt-6 flex justify-center md:mt-10"><TimelineCarousel w={walkthrough} /></div>}
      </main>
    </div>
  )
}

// The one main button, blue like the active step. On hover the white circle grows across the whole button
// from the right and the text turns blue. small: the header's size.
function StartButton({ to, label, small, className }: { to: string; label: string; small?: boolean; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative isolate flex items-center overflow-hidden rounded-full bg-sommet font-bold text-white shadow-[0_10px_28px_-10px_rgb(0_0_0/0.45)] hover:text-sommet focus-visible:text-sommet',
        small ? 'gap-2 py-1 pr-1 pl-4 text-sm' : 'gap-3 py-1.5 pr-1.5 pl-5 text-md',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute right-1.5 -z-10 rounded-full bg-white transition-[width] duration-400 ease-out motion-reduce:transition-none', small ? 'inset-y-1 right-1 w-7 group-hover:w-[calc(100%-0.5rem)] group-focus-visible:w-[calc(100%-0.5rem)]' : 'inset-y-1.5 w-9 group-hover:w-[calc(100%-0.75rem)] group-focus-visible:w-[calc(100%-0.75rem)]')} />
      <span className="transition-colors duration-300">{label}</span>
      <span aria-hidden="true" className={cn('flex items-center justify-center rounded-full text-sommet transition-transform duration-300 group-hover:translate-x-0.5', small ? 'size-7' : 'size-9')}>
        <svg width={small ? 14 : 16} height={small ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </Link>
  )
}
