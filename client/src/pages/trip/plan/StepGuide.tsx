import { useState, type ReactNode } from 'react'
import type { TripState } from '@shared/types'
import { cn } from '../../../lib/cn'
import { PLAN_STEPS, currentStep, fromKey, monthName } from '../../../lib/plan'
import { ChevronDownIcon } from '../../../components/layout/icons'

// The bar with the four planning steps from the mockups. While the group plans it is always open;
// after the dates are confirmed it collapses into one line ("Planning done · Bali · …"), so the trip itself gets the room.
export function PlanProgress({ state, stayCount }: { state: TripState; stayCount: number }) {
  const [open, setOpen] = useState(false)
  const step = currentStep(state.phase, stayCount)
  const collapsible = state.phase === 'done'

  const bar = (
    <ol aria-label="Planning steps" className="flex gap-1.5 lg:gap-2">
      {PLAN_STEPS.map((name, i) => {
        const done = i < step || step === PLAN_STEPS.length - 1
        return (
          <li key={name} aria-current={i === step ? 'step' : undefined} className="flex flex-1 flex-col gap-1.5">
            <span aria-hidden="true" className={cn('h-1.5 rounded-full', i <= step ? 'bg-sommet' : 'bg-line')} />
            <span className={cn('text-xs lg:text-caption', i === step ? 'font-bold text-sommet' : done ? 'font-semibold text-subtle' : 'font-semibold text-muted')}>
              <span className="hidden lg:inline">{i + 1} </span>{name}
              {done && i !== step && <><span aria-hidden="true"> ✓</span><span className="sr-only">, done</span></>}
            </span>
          </li>
        )
      })}
    </ol>
  )

  if (!collapsible) return bar

  const summary = [state.approvedDest, shortDates(state), `${stayCount} ${stayCount === 1 ? 'stay' : 'stays'}`].filter(Boolean).join(' · ')
  return (
    <div className="flex flex-col gap-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex items-center gap-2.5 text-left">
        <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', step === 3 ? 'bg-sommet text-white' : 'bg-chemin text-roche')}>
          {step === 3
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            : <span className="text-xs font-extrabold">{step + 1}</span>}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          <strong>{step === 3 ? 'Planning done' : `Next: ${PLAN_STEPS[step]}`}</strong> <span className="text-muted">· {summary}</span>
        </span>
        <span aria-hidden="true" className={cn('text-subtle transition-transform', open && 'rotate-180')}><ChevronDownIcon /></span>
      </button>
      {open && bar}
    </div>
  )
}

// "18 – 22 Jan" for the collapsed line
function shortDates(state: TripState) {
  if (!state.finalDate || !state.tripDuration) return null
  const start = fromKey(state.finalDate)
  const end = new Date(start)
  end.setDate(end.getDate() + state.tripDuration - 1)
  const month = (d: Date) => monthName.format(d).split(' ')[0].slice(0, 3)
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`
}

// The dark card at the top of every step: the step's number, what to do now and who decides.
// `aside` sits on the right on a computer, e.g. "3 of 4 voted" or the I'm done button.
export function StepCard({ step, title, children, aside }: { step: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] bg-roche px-4.5 py-4 text-white lg:flex-row lg:items-center lg:gap-4 lg:px-5.5 lg:py-4.5">
      <div className="flex flex-1 items-start gap-3.5 lg:items-center lg:gap-4">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chemin font-extrabold text-roche lg:size-9">{step}</span>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold lg:text-[17px]">
            <span className="sr-only">Step {step}: </span>{title}
          </h2>
          <p className="text-sm/[1.45] text-[#d5dde5] lg:text-[15px]">{children}</p>
        </div>
      </div>
      {aside}
    </div>
  )
}
