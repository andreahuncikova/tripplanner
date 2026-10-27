import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

// A sheet that slides up from the bottom on phones (Invite, Add expense in the mockups)
// and sits in the middle of the screen on desktop. The browser's <dialog> keeps focus inside it
// and closes it with Escape.
export function Modal({ open, onClose, title, description, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the dark backdrop lands on the <dialog> itself, not on its content.
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      aria-labelledby="modal-title"
      className={cn(
        'fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl bg-white text-roche',
        'md:inset-0 md:m-auto md:h-fit md:max-w-lg md:rounded-2xl',
        'backdrop:bg-roche/55',
      )}
    >
      <div className="flex flex-col gap-5 px-5 pt-3 pb-9 md:p-7">
        <div aria-hidden="true" className="h-1.25 w-10 self-center rounded-full bg-line-strong md:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="modal-title" className="text-title font-extrabold">{title}</h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-canvas focus-visible:outline-2 focus-visible:outline-sommet"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
