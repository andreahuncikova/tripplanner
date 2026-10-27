import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-2xl font-semibold">Your trips</h1>
      <Link to="/" className="mt-4 inline-block text-slate-500 underline">Back to start</Link>
    </main>
  )
}
