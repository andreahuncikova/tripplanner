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

  // A round icon above the title: a red "!" before something that deletes, a blue tick before confirming
  const icon = tone === 'danger' ? (
    <span className="flex size-12 items-center justify-center rounded-full bg-danger-light text-danger">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
    </span>
  ) : (
    <span className="flex size-12 items-center justify-center rounded-full bg-ciel-light text-sommet">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  )

  return (
    <Modal open={open} onClose={onClose} title={title} description={text} alertIcon={icon}>
      {children}
      {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      {/* Two buttons of the same width side by side */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={run} disabled={busy}>{busy ? 'One moment…' : confirm}</Button>
      </div>
    </Modal>
  )
}
