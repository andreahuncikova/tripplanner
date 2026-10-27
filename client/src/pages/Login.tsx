import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// Plain working form until the new log-in design is built.
export default function Login() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')

  // Back to the page the user wanted, or the dashboard.
  const next = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  if (user) return <Navigate to={next} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setError('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(String(form.get('username')), email, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const input = 'w-full rounded-md border border-line-strong bg-white px-4 py-3.5'

  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <h1 className="mb-6 font-display text-display font-extrabold tracking-tight">{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === 'register' && <input name="username" placeholder="Name" required className={input} />}
        <input name="email" type="email" placeholder="E-mail" required className={input} />
        <input name="password" type="password" placeholder="Password" required className={input} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="rounded-full bg-sommet px-5 py-4 text-lead font-bold text-white hover:bg-sommet-dark">
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="mt-4 text-sm text-muted underline"
      >
        {mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in'}
      </button>
    </main>
  )
}
