import { Link, useParams } from 'react-router-dom'

export default function Trip() {
  const { tripId } = useParams()

  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-2xl font-semibold">Trip {tripId}</h1>
      <Link to="/dashboard" className="mt-4 inline-block text-slate-500 underline">Back to trips</Link>
    </main>
  )
}
