import { useContext } from 'react'
import { ToastContext } from './ToastContext'

// const toast = useToast(); toast('Link copied')
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>')
  return toast
}
