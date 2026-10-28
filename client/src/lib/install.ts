import { useSyncExternalStore } from 'react'

// Chrome (Android and desktop) fires "beforeinstallprompt" once, soon after the page loads, when the app can be installed.
// We keep the event, so the install banner can open the browser's install dialog later, e.g. on the dashboard.
// This file is imported in main.tsx, so the listener is there before the event comes.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let saved: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()   // no mini-infobar from Chrome, our own banner asks instead
  saved = e as InstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  saved = null
  notify()
})

// True while the browser's install dialog can be opened
export function useCanInstall() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l) } },
    () => saved !== null,
  )
}

// Opens the browser's install dialog. Returns true when the user installed the app.
export async function install(): Promise<boolean> {
  if (!saved) return false
  const event = saved
  saved = null
  notify()
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}

// Already opened from the home screen
export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

// iPhone and iPad have no install event; there the app is added with Share → Add to Home Screen
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
