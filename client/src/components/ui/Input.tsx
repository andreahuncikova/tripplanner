import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  // Hides the label visually but keeps it for screen readers (inputs with a placeholder only).
  hideLabel?: boolean
  error?: string
  hint?: string
}

// A text field with its label above it, as in the log-in and add-expense mockups.
export function Input({ label, hideLabel, error, hint, id, className, ...props }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const noteId = `${inputId}-note`

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className={cn('text-sm font-bold', hideLabel && 'sr-only')}>{label}</label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        className={cn(
          'w-full rounded-md border bg-white px-4 py-3.5 text-base text-roche placeholder:text-faint',
          'focus:border-sommet focus:outline-none focus:ring-1 focus:ring-sommet',
          error ? 'border-danger' : 'border-line-strong',
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p id={noteId} className={cn('text-caption', error ? 'text-danger' : 'text-muted')}>{error ?? hint}</p>
      )}
    </div>
  )
}
