import { useState } from 'react'
import { install, isInstalled, isIos, useCanInstall } from '../lib/install'
import { Button } from './ui'

const DISMISS_KEY = 'tp_install_dismissed'
const DISMISS_DAYS = 30

// "Not now" hides the banner for 30 days on this device
function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

// Asks the user to install TripPlanner on their phone (PWA).
// Android and desktop Chrome: a button that opens the browser's install dialog.
// iPhone: a short instruction, because Safari has no install button for websites.
export function InstallBanner() {
  const canInstall = useCanInstall()
  const [hidden, setHidden] = useState(() => isInstalled() || dismissedRecently())
  const ios = isIos()

  if (hidden || (!canInstall && !ios)) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode: it just shows again next time */ }
    setHidden(true)
  }

  async function onInstall() {
    if (await install()) setHidden(true)
  }

  return (
    <section aria-label="Install the app" className="flex items-center gap-3.5 rounded-xl bg-white p-4 shadow-card">
      <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-md">Install TripPlanner</strong>
        <span className="text-caption text-muted">
          {canInstall
            ? 'Open it from your home screen like an app.'
            : <>Tap <ShareIcon /> Share, then <strong className="font-semibold text-roche">Add to Home Screen</strong>.</>}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="link" size="sm" onClick={dismiss}>{canInstall ? 'Not now' : 'Got it'}</Button>
        {canInstall && <Button size="sm" pill onClick={onInstall}>Install</Button>}
      </div>
    </section>
  )
}

// The iOS share icon (a box with an arrow up), so the instruction matches what the user sees in Safari
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline -mt-0.5 text-sommet">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
