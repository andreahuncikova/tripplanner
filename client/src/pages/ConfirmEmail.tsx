import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { Logo } from '../components/layout/icons'

// The page the link in the e-mail opens: /confirm-email?token=…
// It needs no log-in, because the link may be opened on another device or in the e-mail app's browser.
export default function ConfirmEmail() {
  const [params] = useSearchParams()
  const { user, refresh } = useAuth()
  const [state, setState] = useState<{ email: string } | { error: string } | null>(null)
  // React runs effects twice while developing; the link works only once, so it is sent only once
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    api<{ email: string }>('/api/auth/email/confirm', { method: 'POST', body: JSON.stringify({ token: params.get('token') ?? '' }) })
      .then(r => { setState(r); refresh().catch(() => {}) })
      .catch(err => setState({ error: (err as Error).message }))
  }, [params, refresh])

  const link = 'inline-flex min-h-12 items-center justify-center rounded-md bg-roche px-5 font-bold text-white no-underline hover:bg-roche-light hover:text-white'
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas p-6 text-center">
      <Logo size={40} />
      {state === null && <p role="status" className="text-muted">Confirming your new e-mail…</p>}
      {state && 'email' in state && (
        <>
          <h1 className="text-heading font-extrabold">E-mail changed</h1>
          <p className="max-w-sm text-subtle">From now on you log in with <strong>{state.email}</strong>.</p>
          <Link to={user ? '/profile' : '/login'} className={link}>{user ? 'Back to your profile' : 'Log in'}</Link>
        </>
      )}
      {state && 'error' in state && (
        <>
          <h1 className="text-heading font-extrabold">The link did not work</h1>
          <p role="alert" className="max-w-sm text-subtle">{state.error}</p>
          <Link to={user ? '/profile' : '/login'} className={link}>{user ? 'Go to your profile' : 'Log in'}</Link>
        </>
      )}
    </main>
  )
}
