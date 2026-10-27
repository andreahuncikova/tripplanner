import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-heading font-extrabold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-muted underline">Back to start</Link>
    </main>
  )
}
