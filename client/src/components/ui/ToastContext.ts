import { createContext } from 'react'

export interface ToastOptions {
  // error: something failed (red); otherwise a neutral confirmation.
  tone?: 'info' | 'error'
}

export const ToastContext = createContext<((message: string, options?: ToastOptions) => void) | null>(null)
