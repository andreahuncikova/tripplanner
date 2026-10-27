import { Navigate, createBrowserRouter } from 'react-router-dom'
import App from './App'
import RequireAuth from './components/RequireAuth'
import AppShell from './components/layout/AppShell'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import UiGallery from './pages/UiGallery'
import TripLayout from './pages/trip/TripLayout'
import { BudgetSection, ChatSection, ItinerarySection, PlanSection, StaysSection } from './pages/trip/sections'

// Every page of the app. App wraps them all and renders the current one in its <Outlet />.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,   element: <Landing /> },
      { path: 'login', element: <Login /> },
      // Overview of the UI components, for checking them against the mockups.
      { path: 'ui',    element: <UiGallery /> },
      {
        // Pages below need a logged-in user and sit next to the sidebar on desktop.
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: 'dashboard', element: <Dashboard /> },
              {
                path: 'trips/:tripId',
                element: <TripLayout />,
                children: [
                  { index: true,       element: <Navigate to="plan" replace /> },
                  { path: 'plan',      element: <PlanSection /> },
                  { path: 'stays',     element: <StaysSection /> },
                  { path: 'itinerary', element: <ItinerarySection /> },
                  { path: 'budget',    element: <BudgetSection /> },
                  { path: 'chat',      element: <ChatSection /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
