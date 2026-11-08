import { useEffect, useState } from 'react'

// How long each step is shown, and how often the progress bar moves.
const STEP_MS = 6000
const TICK_MS = 100

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The state of the landing walkthrough: which of its count steps is shown, shared by the path and the phone card.
// It moves to the next step every 6 seconds and can be paused; with reduced motion it starts paused.
export function useWalkthrough(count: number) {
  // The step shown and how long it has been shown, together so the progress bar and the step change at once.
  const [{ step, elapsed }, setProgress] = useState({ step: 0, elapsed: 0 })
  const [paused, setPaused] = useState(prefersReducedMotion)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setProgress(p => (
      p.elapsed + TICK_MS >= STEP_MS
        ? { step: (p.step + 1) % count, elapsed: 0 }
        : { step: p.step, elapsed: p.elapsed + TICK_MS }
    )), TICK_MS)
    return () => clearInterval(timer)
  }, [paused, count])

  return {
    step,
    paused,
    togglePause: () => setPaused(p => !p),
    goTo: (i: number) => setProgress({ step: i, elapsed: 0 }),
    // How full the bar of step i is, in percent.
    progress: (i: number) => (i < step ? 100 : i === step ? Math.min(100, (elapsed / STEP_MS) * 100) : 0),
  }
}

export type WalkthroughState = ReturnType<typeof useWalkthrough>
