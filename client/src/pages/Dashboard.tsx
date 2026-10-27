import { useAuth } from '../auth/useAuth'
import { useSocket } from '../socket/useSocket'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()

  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-heading font-extrabold">Your trips</h1>
      <p className="mt-2 text-muted">
        Logged in as {user?.username} · live connection {connected ? 'on' : 'off'}
      </p>
      <button onClick={logout} className="mt-6 text-sm text-muted underline">Log out</button>
    </main>
  )
}
