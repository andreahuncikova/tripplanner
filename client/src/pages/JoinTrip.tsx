import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { TripPreview, TripSummary } from '@shared/types'
import { ApiError, api } from '../lib/api'
import { cleanCode, people, phases } from '../lib/trips'
import { Button } from '../components/ui'
import { BackIcon } from '../components/layout/icons'

type Status = 'idle' | 'loading' | 'found' | 'missing' | 'error'

// The code field, a preview of the trip as soon as the code is complete, and the Join button.
// Used on its own page on phones (/join) and inside a window on the dashboard on desktop.
export function JoinTripForm({ initialCode = '' }: { initialCode?: string }) {
  const navigate = useNavigate()
  const inputId = useId()
  const [code, setCode] = useState(() => cleanCode(initialCode))
  const [preview, setPreview] = useState<TripPreview | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [myCodes, setMyCodes] = useState<string[]>([])
  const [joining, setJoining] = useState(false)

  // The user's own trips, to say "You are already in this trip" instead of joining again
  useEffect(() => {
    api<{ groups: TripSummary[] }>('/api/groups')
      .then(r => setMyCodes(r.groups.map(g => g.inviteCode)))
      .catch(() => setMyCodes([]))
  }, [])

  // Look the trip up as soon as the code has all 8 characters
  useEffect(() => {
    if (code.length !== 8) {
      setPreview(null)
      setStatus('idle')
      return
    }
    const request = new AbortController()
    setStatus('loading')
    api<TripPreview>(`/api/groups/${code}`, { signal: request.signal })
      .then(p => { setPreview(p); setStatus('found') })
      .catch(err => {
        if (request.signal.aborted) return
        setPreview(null)
        if (err instanceof ApiError && err.status === 404) setStatus('missing')
        else { setStatus('error'); setMessage((err as Error).message) }
      })
    // A newer code cancels the request for the older one
    return () => request.abort()
  }, [code])

  const alreadyIn = preview !== null && myCodes.includes(preview.inviteCode)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!preview) return
    setJoining(true)
    try {
      if (!alreadyIn) await api(`/api/groups/${preview.inviteCode}/join`, { method: 'POST' })
      navigate(`/trips/${preview.inviteCode}`)
    } catch (err) {
      setStatus('error')
      setMessage((err as Error).message)
      setJoining(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5.5">
      <div className="flex flex-col gap-2.5">
        <label htmlFor={inputId} className="text-md font-bold">Trip code</label>
        <input
          id={inputId}
          value={code}
          onChange={e => setCode(cleanCode(e.target.value))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={`${inputId}-hint`}
          className="w-full rounded-[14px] border-2 border-sommet bg-white p-4 text-center font-mono text-[26px] font-extrabold tracking-[0.22em] text-roche focus:ring-2 focus:ring-sommet/30 focus:outline-none"
        />
        <p id={`${inputId}-hint`} className="text-sm text-muted">8 letters and numbers. You find it in the invite link your friend sent.</p>
      </div>

      {status === 'loading' && <p className="text-sm text-muted" role="status">Looking for the trip…</p>}
      {status === 'missing' && (
        <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">
          No trip has this code. Check it with the friend who invited you.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{message}</p>
      )}

      {preview && status === 'found' && (
        <section aria-label="Trip found" className="overflow-hidden rounded-xl border border-line lg:flex lg:items-center lg:gap-4 lg:p-3.5">
          <div className="relative h-[120px] bg-ciel lg:h-18 lg:w-24 lg:shrink-0 lg:rounded-md">
            <span className="absolute top-3.5 left-3.5 rounded-full bg-white px-2.5 py-1.5 text-xs font-bold text-success lg:hidden">Trip found</span>
          </div>
          <div className="flex flex-col gap-2.5 p-4 lg:gap-1 lg:p-0">
            <span className="hidden text-xs font-bold text-success lg:block">Trip found</span>
            <div className="flex flex-col gap-0.5">
              <strong className="text-[19px] lg:text-lg">{preview.name}</strong>
              <span className="text-sm text-muted">
                Organised by {preview.adminUsername} · {people(preview.memberCount)}
                {preview.finalDateLabel && ` · ${preview.finalDateLabel}`}
              </span>
            </div>
            <span className="text-caption text-subtle">
              {alreadyIn ? 'You are already in this trip.' : phases[preview.phase].now}
            </span>
          </div>
        </section>
      )}

      <div className="mt-auto pt-2">
        <Button type="submit" size="lg" pill fullWidth disabled={status !== 'found' || joining}>
          <span className="truncate">
            {joining ? 'Joining…' : preview && status === 'found' ? `${alreadyIn ? 'Open' : 'Join'} ${preview.name}` : 'Join trip'}
          </span>
        </Button>
      </div>
    </form>
  )
}

// The "Join a trip" page. An invite link can fill in the code: /join?code=A3BF92C1
export default function JoinTrip() {
  const [params] = useSearchParams()

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:items-center lg:justify-center lg:bg-canvas lg:p-6">
      <div className="flex flex-1 flex-col lg:w-full lg:max-w-[560px] lg:flex-none lg:rounded-[24px] lg:bg-white lg:p-8 lg:shadow-float">
        <header className="flex items-center gap-1 px-3 pt-3 pb-2 lg:flex-col lg:items-start lg:gap-1.5 lg:p-0 lg:pb-5">
          <Link to="/dashboard" aria-label="Back to your trips" className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
            <BackIcon />
          </Link>
          <h1 className="text-xl font-extrabold lg:text-[26px]">Join a trip</h1>
          <p className="hidden text-muted lg:block">Enter the code from the invite your friend sent.</p>
        </header>
        <div className="flex flex-1 flex-col px-5 pt-3 pb-5 lg:p-0">
          <JoinTripForm initialCode={params.get('code') ?? ''} />
        </div>
      </div>
    </div>
  )
}
