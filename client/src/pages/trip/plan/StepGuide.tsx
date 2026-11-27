import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { PLAN_STEPS } from '../../../lib/plan'

// The dark blue card at the top of the Plan tab, drawn like the nights card in the Stays tab: a ring with how many steps are
// done and a tile for each step with its line on top, then what to do now in a box under them.
// `step` is the step's number, or 'done' when the group is ready to go. `aside` sits on the right of the box on a
// computer, e.g. "3 of 4 voted" or the I'm done button. `agreed` is what the finished steps decided ("Bali").
// `back` is the organiser's "Go back a step" pill, on its own row at the top left of the card.
export function StepCard({ step, title, children, aside, agreed, back }: {
  step: number | 'done'; title: string; children: ReactNode; aside?: ReactNode; agreed?: (string | null)[]; back?: ReactNode
}) {
  const index = step === 'done' ? PLAN_STEPS.length : step - 1
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sommet p-4 text-white">
      {/* The organiser's "Go back a step" pill, on its own row at the top left */}
      {back && <div className="-mb-1 flex">{back}</div>}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <StepsRing done={index} />
        <PlanProgress step={index} agreed={agreed} />
      </div>
      {/* What to do now: a slim box, the title and one short line */}
      <div className="flex flex-col gap-2.5 rounded-lg bg-white/6 px-3.5 py-2.5 ring-1 ring-white/10 ring-inset lg:flex-row lg:items-center lg:gap-4 lg:px-4 lg:py-3">
        <div className="flex flex-1 items-center gap-3">
          <span aria-hidden="true" className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-chemin/15 text-xs font-extrabold text-chemin">
            {step === 'done' ? '✓' : step}
          </span>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold">
              {step !== 'done' && <span className="sr-only">Step {step}: </span>}{title}
            </h2>
            <p className="text-sm text-white/70">{children}</p>
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
    <div className="flex shrink-0 items-center gap-2.5">
      <svg width="38" height="38" viewBox="0 0 44 44" aria-hidden="true" className="-rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" className="stroke-white/15" />
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={ring} strokeDashoffset={ring * (1 - count / total)}
          className="stroke-ciel transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold">{count} of {total}</span>
        <span className={cn('text-xs', all ? 'font-semibold text-white' : 'text-white/70')}>{all ? 'All steps done' : 'steps done'}</span>
      </div>
    </div>
  )
}

// A tile for each planning step, like the nights in Stays: the step and what was agreed in one row ("Destination ✓ Bali").
// The line on top is blue when the step is done,
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
              className={cn('flex min-w-0 flex-1 items-start gap-2 border-t-2 pt-2.5', done ? 'border-ciel' : now ? 'border-chemin' : 'border-white/20')}
            >
              {/* A small round mark: a blue tick when done, an amber dot for now, an empty ring for next */}
              <span aria-hidden="true" className={cn(
                'flex size-4.5 shrink-0 translate-y-0.5 items-center justify-center rounded-full',
                done ? 'bg-ciel text-sommet' : now ? 'ring-2 ring-chemin ring-inset' : 'ring-2 ring-white/25 ring-inset',
              )}>
                {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                {now && <span className="size-1.5 rounded-full bg-chemin" />}
              </span>
              <span className={cn('min-w-0 truncate text-sm', !done && !now ? 'text-white/45' : 'text-white/70')}>
                {name}
                {done && <span className="sr-only">, done</span>}
                {/* What the step decided, in plain words after a colon: "Destination: Bali", "Availability: Now" */}
                {(done || now) && <span aria-hidden="true">:</span>}
                {done && <strong className="ml-1.5 font-semibold text-white">{capital(agreed?.[i] ?? 'Agreed')}</strong>}
                {now && <span className="ml-1.5 font-semibold text-chemin">Now</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <span className="sr-only">{ready ? 'All planning steps are done.' : `Step ${step + 1} of ${PLAN_STEPS.length}.`}</span>
    </div>
  )
}

// "bali" → "Bali", whatever was typed
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
