import { useState } from 'react'
import { install, isInstalled, isIos, useCanInstall } from '../lib/install'

// A small "Install app" button for the landing page's navbar, on the blue page; the dashboard has the larger InstallBanner.
// Chrome (Android, desktop): opens the browser's install dialog. iPhone: shows how to add it from Safari's Share menu.
// Hidden when the app is already installed, the browser cannot install it, or on a computer with a mouse.
export function InstallButton() {
  const canInstall = useCanInstall()
  const [installed, setInstalled] = useState(isInstalled)
  const [showHelp, setShowHelp] = useState(false)
  const ios = isIos()

  if (installed || (!canInstall && !ios)) return null

  async function onClick() {
    if (canInstall) {
      if (await install()) setInstalled(true)
    } else {
      setShowHelp(s => !s)
    }
  }

  return (
    // Only on phones and tablets: hidden on computers with a mouse, where hardly anyone installs it.
    <div className="relative pointer-fine:hidden">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={ios ? showHelp : undefined}
        className="group flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white md:text-md"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" />
        </svg>
        {/* The same hover as "Join with a code" next to it: a line under the text that draws itself from left to right. */}
        <span className="relative after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 group-hover:after:scale-x-100 group-focus-visible:after:scale-x-100">
          Install app
        </span>
      </button>
      {showHelp && (
        <p role="status" className="absolute top-full right-0 z-10 mt-2 w-60 rounded-lg bg-roche p-3 text-caption text-white shadow-float">
          In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  )
}
