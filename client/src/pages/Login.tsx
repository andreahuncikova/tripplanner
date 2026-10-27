import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Button, Input, Tabs } from '../components/ui'

// Same rule as the server (server/src/validation.ts)
const PASSWORD_MIN = 8

type Mode = 'login' | 'signup'

const PHOTO_ALT = 'Friends running into the sea on a sunny beach'

// Log in and sign up on one page, as in the mockups "Log in / sign up" (mobile) and "Desktop · Log in / sign up".
// The mode is in the address (/login?mode=signup), so other pages can link straight to the sign-up form.
export default function Login() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'signup' ? 'signup' : 'login'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Back to the page the user wanted, or the dashboard.
  const next = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  if (user) return <Navigate to={next} replace />

  function switchMode(m: Mode) {
    setError('')
    // Keep location.state, so the user still comes back to the page they wanted
    setParams(m === 'signup' ? { mode: 'signup' } : {}, { replace: true, state: location.state })
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(String(form.get('username')), email, password)
      navigate(next, { replace: true })
    } catch (err) {
      // The server's own message, e.g. "Incorrect email or password" or "Email already in use"
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const longEnough = password.length >= PASSWORD_MIN

  return (
    <div className="min-h-dvh bg-white lg:flex lg:gap-3.5 lg:p-3.5">
      {/* Mobile: photo on top, the form slides over it */}
      <div className="relative h-[220px] lg:hidden">
        <img src="/login-hero.jpg" alt={PHOTO_ALT} className="size-full object-cover object-[50%_60%]" />
        <Link
          to="/"
          aria-label="Back to the home page"
          className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/90 text-roche hover:text-roche"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
      </div>

      <main className="relative -mt-7 rounded-t-2xl bg-white px-5 pb-7 pt-6.5 lg:mt-0 lg:flex lg:flex-[1_1_460px] lg:flex-col lg:rounded-none lg:px-10 lg:py-6">
        <Link to="/" className="hidden items-center gap-2.5 text-xl font-extrabold text-roche hover:text-roche lg:flex">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="10" className="fill-sommet" /><path d="M9 20l14-8-5 12-2-5z" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" /></svg>
          TripPlanner
        </Link>

        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-[18px] lg:flex-1 lg:justify-center lg:gap-5 lg:py-8">
          <h1 className="font-display text-display font-extrabold tracking-[-0.02em] lg:text-[44px] lg:tracking-[-0.03em]">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>

          <Tabs
            label="Log in or sign up"
            value={mode}
            onChange={switchMode}
            items={[{ value: 'login', label: 'Log in' }, { value: 'signup', label: 'Sign up' }]}
          />

          {/* key: a fresh form for each mode, so the browser offers the right saved passwords */}
          <form key={mode} onSubmit={onSubmit} className="flex flex-col gap-[18px] lg:gap-5">
            {mode === 'signup' && (
              <Input label="Your name" name="username" autoComplete="name" maxLength={30} required />
            )}
            <Input label="Email" name="email" type="email" autoComplete="email" required />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? PASSWORD_MIN : undefined}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              hint={mode === 'signup' ? `${longEnough ? '✓ ' : ''}At least ${PASSWORD_MIN} characters` : undefined}
              hintTone={longEnough ? 'success' : 'muted'}
            />

            {error && (
              <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>
            )}

            <Button type="submit" size="lg" pill fullWidth disabled={busy} className="mt-1">
              {mode === 'login' ? (busy ? 'Logging in…' : 'Log in') : (busy ? 'Creating account…' : 'Create account')}
            </Button>
          </form>

          <p className="text-center text-sm text-muted">
            {mode === 'login' ? (
              <>New here? <SwitchLink onClick={() => switchMode('signup')}>Create an account</SwitchLink> — you only need a name, email and password.</>
            ) : (
              <>Already have an account? <SwitchLink onClick={() => switchMode('login')}>Log in</SwitchLink></>
            )}
          </p>
        </div>
      </main>

      {/* Desktop: photo with a short message next to the form */}
      <aside className="relative hidden min-h-[560px] flex-[1_1_520px] overflow-hidden rounded-2xl bg-sommet lg:block">
        <img src="/login-hero.jpg" alt={PHOTO_ALT} className="absolute inset-0 size-full object-cover object-[55%_60%]" />
        <div className="absolute inset-x-7 bottom-7 flex flex-col gap-1.5 rounded-xl bg-roche/60 px-[22px] py-5 text-white backdrop-blur-md">
          <strong className="font-display text-2xl">Planned in one place.</strong>
          <span className="text-md text-[#E8ECF1]">Destination, dates, stays and costs — decided together with your friends.</span>
        </div>
        <span className="absolute right-4 top-3 text-2xs text-white/90">Photo: Vidar Nordli-Mathisen / Unsplash</span>
      </aside>
    </div>
  )
}

// Looks like a link but switches the form, so it is a button (it does not go to another page)
function SwitchLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="font-bold text-sommet hover:text-sommet-dark">
      {children}
    </button>
  )
}
