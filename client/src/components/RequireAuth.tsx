import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// Wraps the pages that need a logged-in user; anyone else is sent to /login and comes back after logging in.
export default function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  // pathname + search, so an invite link like /join?code=A3BF92C1 keeps its code through the log-in
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
