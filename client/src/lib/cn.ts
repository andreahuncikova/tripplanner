// Joins class names and skips empty ones: cn('a', isOn && 'b') → 'a b' or 'a'.
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
