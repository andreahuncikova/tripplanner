import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { PLAN_STEPS } from '../../../lib/plan'

// The dark blue card at the top of the Plan tab, drawn like the nights card in the Stays tab: a ring with how many steps are
// done and a tile for each step with its line on top, then what to do now in a box under them.
// `step` is the step's number, or 'done' when the group is ready to go. `aside` sits on the right of the box on a
// computer, e.g. "3 of 4 voted" or the I'm done button. `agreed` is what the finished steps decided ("Bali").
export function StepCard({ step, title, children, aside, agreed }: {
  step: number | 'done'; title: string; children: ReactNode; aside?: ReactNode; agreed?: (string | null)[]
}) {
  const index = step === 'done' ? PLAN_STEPS.length : step - 1
  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-sommet p-4.5 text-white lg:p-5.5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
        <StepsRing done={index} />
        <PlanProgress step={index} agreed={agreed} />
      </div>
      <div className="flex flex-col gap-3.5 rounded-xl bg-white/6 p-3.5 ring-1 ring-white/10 ring-inset lg:flex-row lg:items-center lg:gap-4 lg:p-4">
        <div className="flex flex-1 items-start gap-3 lg:items-center">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chemin/15 text-sm font-extrabold text-chemin">
            {step === 'done' ? '✓' : step}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold lg:text-[17px]">
              {step !== 'done' && <span className="sr-only">Step {step}: </span>}{title}
            </h2>
            <p className="text-sm/[1.45] text-white/85">{children}</p>
          </div>
        </div>
        {aside}
      </div>
    </div>
  )
}

// "1 of 2 steps done" with a light blue ring that fills up, like "3 of 9 nights booked" in Stays
function StepsRing({ done }: { done: number }) {
  const total = PLAN_STEPS.length
  const count = Math.min(done, total)
  const all = count === total
  const ring = 2 * Math.PI * 18
  return (
    <div className="flex shrink-0 items-center gap-3.5 md:pt-1">
      <svg width="52" height="52" viewBox="0 0 44 44" aria-hidden="true" className="-rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" className="stroke-white/15" />
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={ring} strokeDashoffset={ring * (1 - count / total)}
          className="stroke-ciel transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className={cn('text-title font-extrabold', all && 'text-ciel')}>{count} of {total}</span>
        <span className={cn('text-sm', all ? 'font-semibold text-ciel' : 'text-white/70')}>{all ? 'All steps done' : 'steps done'}</span>
      </div>
    </div>
  )
}

// A tile for each planning step, like the nights in Stays: the line on top is blue when the step is done,
// amber for the step the group is in, faint for the next one. A done step shows what the group agreed on.
// `step` is the index of the current step, or PLAN_STEPS.length when every step is done.
function PlanProgress({ step, agreed }: { step: number; agreed?: (string | null)[] }) {
  const ready = step >= PLAN_STEPS.length
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ol aria-label="Planning steps" className="flex gap-2">
        {PLAN_STEPS.map((name, i) => {
          const done = i < step
          const now = i === step
          return (
            <li
              key={name}
              aria-current={now ? 'step' : undefined}
              className={cn('flex min-w-0 flex-1 flex-col gap-0.5 border-t-2 pt-2', done ? 'border-ciel' : now ? 'border-chemin' : 'border-white/20')}
            >
              <span className="text-2xs font-bold tracking-wider text-white/70 uppercase">
                {name}
                {done && <><span aria-hidden="true"> ✓</span><span className="sr-only">, done</span></>}
              </span>
              <span className={cn('text-lg leading-6 font-semibold md:truncate', !done && !now && 'text-white/40')}>
                {done ? agreed?.[i] ?? 'Agreed' : now ? 'Now' : 'Next'}
              </span>
            </li>
          )
        })}
      </ol>
      <span className="sr-only">{ready ? 'All planning steps are done.' : `Step ${step + 1} of ${PLAN_STEPS.length}.`}</span>
    </div>
  )
}
