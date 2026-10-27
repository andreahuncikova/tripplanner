import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import RequireAuth from './components/RequireAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Trip from './pages/Trip'
import NotFound from './pages/NotFound'

// Every page of the app. App wraps them all and renders the current one in its <Outlet />.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,   element: <Landing /> },
      { path: 'login', element: <Login /> },
      {
        // Pages below need a logged-in user.
        element: <RequireAuth />,
        children: [
          { path: 'dashboard',     element: <Dashboard /> },
          { path: 'trips/:tripId', element: <Trip /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
