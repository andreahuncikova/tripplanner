import { Outlet } from 'react-router-dom'

// Root of the app. The shared layout will wrap the <Outlet /> here; the logged-in user and the socket come from the providers in main.tsx.
export default function App() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  )
}
