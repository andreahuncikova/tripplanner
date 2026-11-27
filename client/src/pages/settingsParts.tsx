import { useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Button } from '../components/ui'

// The parts of the settings pages (Trip settings and Profile), so both look the same.

// A group of rows with a small heading. Phones: the heading above a white box. Desktop: one white card.
export function Section({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('flex flex-col gap-2 lg:gap-0 lg:rounded-xl lg:bg-white lg:py-2 lg:shadow-card', className)}>
      <div className="flex items-center justify-between px-1 lg:px-5 lg:pt-2.5 lg:pb-1.5">
        <h2 className="text-2xs font-bold tracking-widest text-muted uppercase">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col rounded-lg bg-white shadow-card lg:shadow-none">{children}</div>
    </section>
  )
}

const rowClass = 'flex w-full items-center justify-between gap-4 border-b border-line px-4 py-4 text-left last:border-b-0 lg:px-5'

// One setting. Without onEdit (a member, or dates the group voted on) it only shows the value.
export function Row({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  if (!onEdit) {
    return (
      <div className={rowClass}>
        <span className="shrink-0">{label}</span>
        <span className="truncate text-muted">{value}</span>
      </div>
    )
  }
  return (
    <button type="button" onClick={onEdit} aria-label={`Change the ${label.toLowerCase()} (${value})`} className={cn(rowClass, 'hover:bg-canvas')}>
      <span className="shrink-0">{label}</span>
      <span className="truncate text-muted">
        {value}<span className="lg:hidden"> ›</span><span className="hidden lg:inline"> · Edit</span>
      </span>
    </button>
  )
}

// The form inside an edit dialog: its fields, an error from the server and Save
export function EditForm({ onSave, children }: { onSave: (form: FormData) => Promise<void>; children: ReactNode }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave(new FormData(e.currentTarget))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {children}
      {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
    </form>
  )
}

