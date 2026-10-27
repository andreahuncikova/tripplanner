import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

// Placeholder until the real landing page. The status line checks that the client reaches the server.
export default function Landing() {
  const [server, setServer] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    api('/api/fx-rates')
      .then(() => setServer('ok'))
      .catch(() => setServer('down'))
  }, [])

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <img src="/logo.svg" alt="" className="h-12" />
      <h1 className="text-3xl font-semibold">TripPlanner</h1>
      <Link to="/login" className="rounded-lg bg-slate-900 px-5 py-2.5 text-white">Log in</Link>
      <p className="text-sm text-slate-500">
        Server: {server === 'checking' ? 'checking…' : server === 'ok' ? 'connected' : 'not reachable'}
      </p>
    </main>
  )
}
