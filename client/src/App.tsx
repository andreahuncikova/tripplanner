import { Outlet } from 'react-router-dom'

// Root of the app. Shared things (layout, logged-in user, socket) will wrap the <Outlet /> here.
export default function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <Outlet />
    </div>
  )
}
