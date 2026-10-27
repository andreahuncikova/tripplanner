import type { KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: string
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  // segmented: a switch in a grey box (Log in / Sign up); underline: a line under the active tab (trip sections on desktop).
  variant?: 'segmented' | 'underline'
}

// Tabs that switch content on the same page. The arrow keys move between tabs, as screen-reader users expect.
export function Tabs<T extends string>({ items, value, onChange, label, variant = 'segmented' }: TabsProps<T>) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = items.findIndex(t => t.value === value)
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length]
    if (!next) return
    onChange(next.value)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex', variant === 'segmented' ? 'rounded-[14px] bg-canvas p-1' : 'gap-7 border-b border-line')}
    >
      {items.map(t => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            data-value={t.value}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              variant === 'segmented'
                ? cn('flex-1 rounded-[11px] p-2.5', active ? 'bg-white font-bold text-roche shadow-raised' : 'font-semibold text-muted')
                : cn('-mb-px border-b-3 pb-3.5', active ? 'border-sommet font-bold text-sommet' : 'border-transparent font-semibold text-subtle'),
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
