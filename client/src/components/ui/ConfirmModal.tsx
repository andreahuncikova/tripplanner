import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  title: string
  text: string
  // The label of the button that does it, e.g. "Leave trip"
  confirm: string
  onConfirm: () => Promise<void> | void
  // danger: leaving, deleting, going back a step; primary: confirming the trip dates
  tone?: 'danger' | 'primary'
  // Extra fields above the buttons, e.g. the first day of the trip
  children?: ReactNode
}

// "Are you sure?" before something that is hard to undo, with the server's error if it fails
export function ConfirmModal({ open, onClose, title, text, confirm, onConfirm, tone = 'danger', children }: ConfirmModalProps) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setError('')
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={text}>
      {children}
      {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={tone} onClick={run} disabled={busy}>{busy ? 'One moment…' : confirm}</Button>
      </div>
    </Modal>
  )
}
