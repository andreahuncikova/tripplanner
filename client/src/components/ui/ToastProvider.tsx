import { useCallback, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ToastContext, type ToastOptions } from './ToastContext'

interface Toast extends ToastOptions {
  id: number
  message: string
}

// Short messages at the bottom of the screen ("Link copied", "Could not save"), gone after 4 seconds.
// Not in the mockups; drawn in the same style as the dark boxes there.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const id = nextId.current++
    setToasts(list => [...list, { id, message, ...options }])
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Screen readers read new messages in this region aloud. Placed above the bottom tabs on phones. */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 md:bottom-8">
        {toasts.map(t => (
          <p
            key={t.id}
            className={cn(
              'rounded-md px-4.5 py-3 text-md font-semibold shadow-float',
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-roche text-white',
            )}
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
