import { cn } from '../../lib/cn'

const sizes = {
  sm: 'size-7 text-2xs',
  md: 'size-9 text-sm',
  lg: 'size-11 text-base',
}

export interface AvatarProps {
  name: string
  // The user's own colour, given by the server when they sign up.
  color: string
  size?: keyof typeof sizes
  className?: string
}

// A coloured circle with the first letter of the name.
export function Avatar({ name, color, size = 'md', className }: AvatarProps) {
  return (
    <span
      title={name}
      style={{ backgroundColor: color }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', sizes[size], className)}
    >
      <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <span className="sr-only">{name}</span>
    </span>
  )
}

export interface AvatarGroupProps {
  people: { name: string; color: string }[]
  // How many avatars to show before "+N".
  max?: number
  size?: keyof typeof sizes
}

// Overlapping avatars of a trip's members, as on the trip cards.
export function AvatarGroup({ people, max = 3, size = 'sm' }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length

  return (
    <div className="flex">
      {shown.map((p, i) => (
        <Avatar key={p.name} {...p} size={size} className={cn('border-2 border-white', i > 0 && '-ml-2')} />
      ))}
      {rest > 0 && (
        <span className={cn('-ml-2 inline-flex items-center justify-center rounded-full border-2 border-white bg-line font-bold text-subtle', sizes[size])}>
          +{rest}
        </span>
      )}
    </div>
  )
}
