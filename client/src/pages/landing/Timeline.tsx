import { useState } from 'react'
import { cn } from '../../lib/cn'
import { StepPreview } from './StepPreview'
import { steps } from './steps'
import { arrival, usePathFlight } from './usePathFlight'
import type { WalkthroughState } from './useWalkthrough'
import './timeline.css'

// Where each stop sits on the path, in percent of the timeline's width and height: a gentle wave along the city's
// skyline in the middle of the photo. The path is a smooth curve through these points, so the stops sit on the line.
const stops = [
  { x: 13, y: 35 }, { x: 27.8, y: 25 }, { x: 42.6, y: 36 }, { x: 57.4, y: 25 }, { x: 72.2, y: 36 }, { x: 87, y: 25 },
]

// A smooth curve through the points (Catmull-Rom turned into cubic Béziers), from the left edge to the right edge.
function curve(points: { x: number; y: number }[]) {
  const p = [{ x: -1, y: 30 }, ...points, { x: 101, y: 31 }]
  let d = `M ${p[0].x} ${p[0].y}`
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i], b = p[i], c = p[i + 1], e = p[i + 2] ?? c
    d += ` C ${b.x + (c.x - a.x) / 6} ${b.y + (c.y - a.y) / 6}, ${c.x - (e.x - b.x) / 6} ${c.y - (e.y - b.y) / 6}, ${c.x} ${c.y}`
  }
  return d
}

// Wide screens: a path winding along the city's skyline with a stop for each step. The walkthrough moves along it
// on its own (or on a click): the path fills up to the current stop, the stop lights up, and one frosted card glides
// along the path to it and shows a small animated preview of the step. The other stops show their name above the
// path, right above their stop (over the skyline), and the card always opens below the path (over the water).
export function Timeline({ w }: { w: WalkthroughState }) {
  const s = steps[w.step]
  const { x, y } = stops[w.step]
  const path = curve(stops)
  const flight = usePathFlight(x)
  const line = (opacity: number, ref?: typeof flight.path) => (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
      <path ref={ref} d={path} fill="none" stroke="white" strokeOpacity={opacity} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )

  return (
    <ol ref={flight.box} aria-label="How TripPlanner works, step by step" className="absolute inset-0">
      {/* The path draws itself from left to right once; then the solid part follows the walkthrough. A plane flies
          at the tip of the line while it draws (usePathFlight sets the clipping and the plane's place on every frame). */}
      <div ref={flight.reveal} aria-hidden="true" className="absolute inset-0">
        {line(0.35)}
        <div ref={flight.fill} className="absolute inset-0">{line(1, flight.path)}</div>
      </div>
      {/* Under the stops in the page's order, so it lands beneath them. */}
      <div ref={flight.plane} aria-hidden="true" className="pointer-events-none absolute size-0 opacity-0 transition-opacity duration-300">
        <svg width="26" height="26" viewBox="0 0 24 24" className="-mt-[13px] -ml-[13px] rotate-90 drop-shadow-[0_3px_6px_rgb(0_0_0/0.45)]">
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="white" />
        </svg>
      </div>

      {steps.map((step, i) => {
        const p = stops[i]
        const active = i === w.step
        const done = i < w.step
        // The stop and its name appear as the plane flies over them while the path draws itself.
        const appear = { animationDelay: `${arrival(p.x)}s` }
        return (
          // The stop sits on the path and its name right above it (over the skyline); the card opens below the path.
          <li key={step.title} className="contents">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => w.goTo(i)}
              className={cn(
                'tl-card absolute flex cursor-pointer items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-2xs font-bold xl:text-caption whitespace-nowrap shadow-[0_6px_16px_-6px_rgb(0_0_0/0.4)] ring-1 backdrop-blur-md transition-colors duration-300',
                active ? 'bg-white text-sommet ring-white' : 'bg-white/70 text-roche ring-white/60 hover:bg-white',
              )}
              style={{ left: `${p.x}%`, top: `calc(${p.y}% - 60px)`, translate: '-50% 0', ...appear }}
            >
              <span className={cn('flex size-5 items-center justify-center rounded-full text-2xs font-extrabold transition-colors duration-300', active ? 'bg-sommet text-white' : 'bg-roche/10 text-roche')}>{i + 1}</span>
              {step.title}
            </button>
            <button
              type="button"
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${step.title}`}
              onClick={() => w.goTo(i)}
              className={cn(
                'tl-stop absolute -mt-5.5 -ml-5.5 flex size-11 cursor-pointer items-center justify-center rounded-full shadow-[0_6px_18px_-4px_rgb(0_0_0/0.4)] transition-[background-color,color,scale,box-shadow] duration-500 hover:scale-110 motion-reduce:transition-none',
                active ? 'scale-110 bg-sommet text-white ring-6 ring-white/55' : done ? 'bg-white text-sommet ring-4 ring-white/40' : 'bg-white/80 text-sommet ring-4 ring-white/20 backdrop-blur',
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%`, ...appear }}
            >
              {step.icon}
            </button>
          </li>
        )
      })}

      {/* One card that glides from stop to stop; its content fades over when the step changes. */}
      <li
        aria-live="polite"
        className="tl-card absolute z-10 w-64 pt-11 transition-[left,top] xl:w-72 xl:pt-14 duration-700 ease-in-out motion-reduce:transition-none"
        // Rises in with the first stop, when the plane gets there.
        style={{ left: `${x}%`, top: `${y}%`, translate: '-50% 0', animationDelay: `${arrival(stops[0].x)}s` }}
      >
        <div data-light className="relative rounded-2xl bg-white/70 px-3 pt-2 pb-3 text-roche shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] ring-1 ring-white/70 backdrop-blur-xl">
          {/* In the corner, so it does not push the centred text aside. */}
          <span className="absolute top-1 right-1.5"><PauseButton w={w} /></span>
          <div key={w.step} className="tl-swap flex flex-col gap-2">
            {/* The step's name and number are on its label above the path, so the card only says what happens,
                centred under the stop like the card itself. */}
            <p className="truncate px-6 text-center text-2xs leading-snug text-subtle xl:text-caption">{s.text}<span className="sr-only"> (step {w.step + 1}: {s.title})</span></p>
            <div aria-hidden="true" className="rounded-xl bg-white/75 p-2.5"><StepPreview step={w.step} /></div>
          </div>
        </div>
      </li>
    </ol>
  )
}

function PauseButton({ w }: { w: WalkthroughState }) {
  return (
    <button
      type="button"
      aria-label={w.paused ? 'Play walkthrough' : 'Pause walkthrough'}
      onClick={w.togglePause}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-subtle hover:bg-canvas"
    >
      {w.paused
        ? <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" /></svg>}
    </button>
  )
}

// Phones and tablets: one step at a time in a frosted card, moving on by itself like the path on wide screens.
// Bars on top jump to a step, and a swipe goes to the next or the previous one.
export function TimelineCarousel({ w }: { w: WalkthroughState }) {
  const s = steps[w.step]
  const [touchX, setTouchX] = useState<number | null>(null)

  function onTouchEnd(x: number) {
    if (touchX === null) return
    const dx = x - touchX
    if (Math.abs(dx) > 40) w.goTo((w.step + (dx < 0 ? 1 : steps.length - 1)) % steps.length)
    setTouchX(null)
  }

  return (
    <section
      data-light
      aria-label="How TripPlanner works, step by step"
      className="w-full max-w-100 rounded-2xl bg-white/70 p-3 text-roche shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] ring-1 ring-white/70 backdrop-blur-xl"
      onTouchStart={e => setTouchX(e.touches[0].clientX)}
      onTouchEnd={e => onTouchEnd(e.changedTouches[0].clientX)}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {steps.map((step, i) => (
            <button key={step.title} type="button" aria-label={`Step ${i + 1}: ${step.title}`} aria-current={i === w.step ? 'step' : undefined} onClick={() => w.goTo(i)} className="flex-1 cursor-pointer py-2">
              <span className="block h-1 overflow-hidden rounded-full bg-sommet/15">
                <span className="block h-full rounded-full bg-sommet" style={{ width: `${w.progress(i)}%` }} />
              </span>
            </button>
          ))}
        </div>
        <PauseButton w={w} />
      </div>
      <div key={w.step} className="tl-swap mt-1 flex flex-col gap-2.5">
        <div aria-live="polite" className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sommet text-white">{s.icon}</span>
          <span className="flex min-w-0 flex-col">
            <strong className="text-sm"><span className="text-sommet">{w.step + 1}</span> · {s.title}</strong>
            <span className="text-caption leading-snug text-subtle">{s.text}</span>
          </span>
        </div>
        <div aria-hidden="true" className="rounded-xl bg-white/75 p-2.5"><StepPreview step={w.step} /></div>
      </div>
    </section>
  )
}
