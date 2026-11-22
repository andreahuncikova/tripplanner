import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { PLAN_STEPS } from '../../../lib/plan'

// The planning steps as a thin bar with their names, at the top of the step card. This is the only place
// on the trip that shows how far the planning is; the header always has the same section switch.
// `step` is the index of the current step, or PLAN_STEPS.length when every step is done.
// `agreed` is what the group decided in each step ("Bali", "1 – 10 December (10 days)"): after its tick on a computer,
// under it on phones, where both would not fit on one line.
function PlanProgress({ step, agreed }: { step: number; agreed?: (string | null)[] }) {
  const ready = step >= PLAN_STEPS.length
  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Planning steps" className="flex gap-1.5 lg:gap-2">
        {PLAN_STEPS.map((name, i) => {
          const done = i < step
          return (
            <li key={name} aria-current={i === step ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span aria-hidden="true" className={cn('h-1 rounded-full', i <= step ? 'bg-chemin' : 'bg-white/20')} />
              <span className={cn('flex min-w-0 flex-col gap-0.5 text-xs whitespace-nowrap lg:flex-row lg:gap-1.5', i === step ? 'font-bold text-white' : 'font-semibold text-[#9fb0c0]')}>
                <span className="shrink-0">
                  {name}
                  {done && <><span aria-hidden="true"> ✓</span><span className="sr-only">, done</span></>}
                </span>
                {done && agreed?.[i] && <span className="truncate font-bold text-white">{agreed[i]}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <span className="sr-only">{ready ? 'All planning steps are done.' : `Step ${step + 1} of ${PLAN_STEPS.length}.`}</span>
    </div>
  )
}

// The dark card at the top of the Plan tab: the planning steps, then the step's number, what to do now and who decides.
// `step` is the step's number, or 'done' when the group is ready to go. `aside` sits on the right on a computer,
// e.g. "3 of 4 voted" or the I'm done button. `agreed` is what the finished steps decided (see PlanProgress).
export function StepCard({ step, title, children, aside, agreed }: {
  step: number | 'done'; title: string; children: ReactNode; aside?: ReactNode; agreed?: (string | null)[]
}) {
  const index = step === 'done' ? PLAN_STEPS.length : step - 1
  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-roche px-4.5 py-4 text-white lg:px-5.5 lg:py-4.5">
      <PlanProgress step={index} agreed={agreed} />
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex flex-1 items-start gap-3.5 lg:items-center lg:gap-4">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chemin font-extrabold text-roche lg:size-9">
            {step === 'done' ? '✓' : step}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold lg:text-[17px]">
              {step !== 'done' && <span className="sr-only">Step {step}: </span>}{title}
            </h2>
            <p className="text-sm/[1.45] text-[#d5dde5] lg:text-[15px]">{children}</p>
          </div>
        </div>
        {aside}
      </div>
    </div>
  )
}
