import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
// Catches the browser's install event right at start-up (see lib/install.ts)
import './lib/install'
import { router } from './router'
import { AuthProvider } from './auth/AuthProvider'
import { SocketProvider } from './socket/SocketProvider'
import { ToastProvider } from './components/ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
)
