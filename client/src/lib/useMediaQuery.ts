import { useCallback, useSyncExternalStore } from 'react'

// True while the media query matches, e.g. useMediaQuery('(min-width: 768px)'), and updates when it changes.
export function useMediaQuery(query: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
