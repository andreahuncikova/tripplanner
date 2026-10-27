import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // Thick sommet border, e.g. the stay or destination the group picked.
  selected?: boolean
  // No padding, for cards that start with a photo.
  flush?: boolean
}

// White box on the grey app background: trip cards, stay cards, list boxes.
export function Card({ selected, flush, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl bg-white shadow-card',
        selected && 'ring-2 ring-sommet',
        !flush && 'p-4.5',
        className,
      )}
      {...props}
    />
  )
}
