import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Button styles from the mockups. primary: main action (Log in, Confirm), secondary: outlined (Join with code),
// soft: light accent (Invite, Copy), dark: next to inputs (Add), danger: delete, link: text only (+ Add expense).
const variants = {
  primary: 'bg-sommet text-white hover:bg-sommet-dark',
  secondary: 'border border-line-strong bg-white text-roche hover:bg-canvas',
  soft: 'bg-ciel-light text-sommet hover:bg-ciel/40',
  dark: 'bg-roche text-white hover:bg-roche-light',
  danger: 'bg-danger-light text-danger hover:bg-danger-light/70',
  link: 'bg-transparent text-sommet hover:text-sommet-dark',
}

const sizes = {
  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lead',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  // Fully rounded, like the Log in button.
  pill?: boolean
  fullWidth?: boolean
}

export function Button({ variant = 'primary', size = 'md', pill, fullWidth, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sommet',
        variants[variant],
        variant === 'link' ? 'min-h-10' : sizes[size],
        pill ? 'rounded-full' : 'rounded-md',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
