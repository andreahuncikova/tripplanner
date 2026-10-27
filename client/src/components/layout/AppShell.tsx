import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

// The frame around every page for logged-in users: the sidebar on desktop, the page next to it.
export default function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
