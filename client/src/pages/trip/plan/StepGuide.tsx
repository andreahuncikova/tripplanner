import type { ReactNode } from 'react'
import type { TripState } from '@shared/types'
import { cn } from '../../../lib/cn'
import { PLAN_STEPS, currentStep } from '../../../lib/plan'

// The bar with the four planning steps from the mockups. It is only shown while the group plans
// (TripLayout); once the dates are confirmed the section switch takes its place.
export function PlanProgress({ state, stayCount }: { state: TripState; stayCount: number }) {
  const step = currentStep(state.phase, stayCount)
  return (
    <ol aria-label="Planning steps" className="flex gap-1.5 lg:gap-2">
      {PLAN_STEPS.map((name, i) => {
        const done = i < step
        return (
          <li key={name} aria-current={i === step ? 'step' : undefined} className="flex flex-1 flex-col gap-1.5">
            <span aria-hidden="true" className={cn('h-1.5 rounded-full', i <= step ? 'bg-sommet' : 'bg-line')} />
            <span className={cn('text-xs whitespace-nowrap lg:text-caption', i === step ? 'font-bold text-sommet' : done ? 'font-semibold text-subtle' : 'font-semibold text-muted')}>
              <span className="hidden lg:inline">{i + 1} </span>{name}
              {done && <><span aria-hidden="true"> ✓</span><span className="sr-only">, done</span></>}
            </span>
          </li>
        )
      })}
    </ol>
  )
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
