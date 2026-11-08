import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

// A small animated piece of the app for each planning step, shown next to the active stop on the landing timeline.
// Only the form or list that matters for the step, not the whole screen. The sp- animations are in timeline.css;
// each preview is mounted again when its step comes round, so the animation starts over.

// When an element appears or changes, in seconds after the step starts.
const at = (s: number): CSSProperties => ({ animationDelay: `${s}s` })

const Label = ({ children }: { children: ReactNode }) => <span className="text-2xs font-bold tracking-[0.06em] text-muted uppercase">{children}</span>
const Field = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <div className={cn('relative flex h-8 items-center rounded-lg border border-line-strong bg-white px-2.5 text-caption', className)}>{children}</div>
)
const Button = ({ children, done, when }: { children: ReactNode; done: ReactNode; when: number }) => (
  <div className="relative h-8">
    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-sommet text-caption font-bold text-white">{children}</div>
    <div className="sp-show absolute inset-0 flex items-center justify-center rounded-lg bg-[#3e7a3a] text-caption font-bold text-white" style={at(when)}>{done}</div>
  </div>
)
const Swap = ({ from, to, when, className }: { from: ReactNode; to: ReactNode; when: number; className?: string }) => (
  <span className={cn('relative inline-grid', className)}>
    <span className="sp-hide col-start-1 row-start-1" style={at(when)}>{from}</span>
    <span className="sp-show col-start-1 row-start-1" style={at(when)}>{to}</span>
  </span>
)
const Avatar = ({ letter, color, when }: { letter: string; color: string; when?: number }) => (
  <span className={cn('-ml-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white text-2xs font-bold text-white first:ml-0', when !== undefined && 'sp-pop')} style={{ background: color, ...(when !== undefined ? at(when) : {}) }}>{letter}</span>
)

function CreateTrip() {
  return (
    <>
      <Field><span className="mr-2 text-2xs font-bold text-muted uppercase">Trip</span><span className="sp-type whitespace-nowrap" style={at(0.3)}>Bali with friends</span></Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-line-strong px-2.5 py-1 text-caption"><span className="size-3.5 rounded-full border-2 border-faint" />We know our dates</div>
        <div className="relative flex items-center gap-2 rounded-lg border border-line-strong px-2.5 py-1 text-caption">
          <span className="sp-show absolute -inset-px rounded-lg border-2 border-sommet bg-ciel-light" style={at(1.5)} />
          <span className="relative size-3.5 rounded-full border-2 border-faint"><span className="sp-pop absolute -inset-0.5 rounded-full border-4 border-sommet bg-white" style={at(1.5)} /></span>
          <span className="relative">Help us find dates</span>
        </div>
      </div>
      <Button done="✓ Trip created" when={2.6}>Create trip and invite friends</Button>
    </>
  )
}

function Invite() {
  return (
    <>
      <div className="flex flex-col items-center gap-0.5 rounded-lg bg-canvas py-2.5">
        <Label>Trip code</Label>
        <span className="font-mono text-lg font-extrabold tracking-[0.16em]">A3BF92C1</span>
      </div>
      <Button done="✓ Link copied" when={0.9}>Copy invite link</Button>
      <div className="flex items-center justify-between">
        <span className="flex">
          <Avatar letter="M" color="#E86A4A" />
          <Avatar letter="J" color="#3E7CB1" when={1.6} />
          <Avatar letter="S" color="#7A5BA6" when={1.9} />
          <Avatar letter="L" color="#2E8B57" when={2.2} />
          <Avatar letter="E" color="#FFB133" when={2.5} />
        </span>
        <Swap from={<span className="text-caption text-muted">1 person</span>} to={<span className="text-caption font-bold text-success">5 people</span>} when={2.6} />
      </div>
    </>
  )
}

function Vote() {
  const row = (name: string, from: string, to: string, votes: ReactNode, mine?: boolean) => (
    <div className="relative overflow-hidden rounded-lg border border-line">
      <div className={cn('absolute inset-y-0 left-0', mine ? 'sp-grow bg-ciel-light' : 'bg-canvas')} style={{ width: to, '--from': from, '--to': to, ...at(0.9) } as CSSProperties} />
      {mine && <div className="sp-show absolute inset-0 rounded-lg border-2 border-sommet" style={at(0.9)} />}
      <div className="relative flex items-center gap-2 px-2.5 py-1.5 text-caption">
        <span className="relative size-3.5 rounded-full border-2 border-faint">
          {mine && <span className="sp-pop absolute -inset-0.5 flex items-center justify-center rounded-full bg-sommet text-[8px] text-white" style={at(0.9)}>✓</span>}
        </span>
        <strong className="flex-1">{name}</strong>
        <span className="font-bold">{votes}</span>
      </div>
    </div>
  )
  return (
    <>
      {row('Bali, Indonesia', '40%', '60%', <Swap from="2 votes" to="3 votes" when={0.9} />, true)}
      {row('Lisbon, Portugal', '20%', '20%', '1 vote')}
      {row('Split, Croatia', '0%', '0%', '0 votes')}
      <Button done="✓ Bali is your destination" when={2.4}>Confirm Bali</Button>
    </>
  )
}

function Dates() {
  const busy = [8, 9]
  const mine: Record<number, number> = { 3: 0.6, 4: 0.9, 5: 1.2 }
  return (
    <>
      <div className="flex items-baseline justify-between"><strong className="text-caption">March 2027</strong><Label>Tap busy days</Label></div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }, (_, i) => i + 1).map(d => (
          <span key={d} className={cn('relative flex h-6 items-center justify-center rounded-md text-2xs font-semibold', busy.includes(d) ? 'bg-[#D5DDE5] text-subtle' : 'bg-[#D3EEF2]')}>
            {d}
            {mine[d] !== undefined && <span className="sp-pop absolute inset-0 flex items-center justify-center rounded-md bg-roche text-white" style={at(mine[d])}>{d}</span>}
          </span>
        ))}
      </div>
      <div className="sp-pop flex items-center justify-between rounded-lg border-2 border-sommet px-2.5 py-1.5" style={at(2)}>
        <span className="flex flex-col"><strong className="text-caption">10–24 March</strong><span className="text-2xs text-muted">Everyone is free</span></span>
        <Swap from={<span className="rounded-md border border-line-strong px-2 py-0.5 text-2xs font-bold">Vote</span>} to={<span className="rounded-md bg-sommet px-2 py-0.5 text-2xs font-bold text-white">Your vote</span>} when={2.9} />
      </div>
    </>
  )
}

function Stay() {
  return (
    <>
      <div className="flex gap-1.5">
        <Field className="flex-1 overflow-hidden">
          <span className="sp-hide absolute left-2.5 text-faint" style={at(0.25)}>Paste a Booking or Airbnb link…</span>
          <span className="sp-type whitespace-nowrap" style={at(0.3)}>airbnb.com/rooms/48213</span>
        </Field>
        <span className="flex h-8 items-center rounded-lg bg-sommet px-2.5 text-caption font-bold text-white">Add</span>
      </div>
      <div className="sp-pop flex gap-2.5 rounded-lg border-2 border-sommet p-1.5" style={at(1.4)}>
        <span className="h-14 w-16 shrink-0 rounded-md bg-[linear-gradient(160deg,#A3D9E2,#6FB7C4)]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[9px] font-bold tracking-[0.06em] text-muted uppercase">Airbnb</span>
          <strong className="truncate text-caption">Jungle villa with pool</strong>
          <span className="text-2xs text-muted">Ubud · €58 / night</span>
          <Swap from={<span className="text-2xs font-bold text-sommet">Set dates</span>} to={<span className="text-2xs font-bold text-sommet">Booked 12–15 Mar</span>} when={2.8} className="mt-0.5" />
        </span>
        <Swap
          from={<span className="rounded-md border border-line-strong px-1.5 py-0.5 text-2xs font-bold">♡ 3</span>}
          to={<span className="rounded-md bg-danger-light px-1.5 py-0.5 text-2xs font-bold text-danger">♥ 4</span>}
          when={2.1}
          className="self-start"
        />
      </div>
    </>
  )
}

function SettleUp() {
  return (
    <>
      <div className="flex items-end justify-between rounded-lg bg-roche px-3 py-2 text-white">
        <span className="flex flex-col"><span className="text-2xs text-white/70">Group spent</span><strong className="text-lg">€1,284.00</strong></span>
        <span className="flex flex-col items-end"><span className="text-2xs text-white/70">Your share</span><strong className="text-caption">€256.80</strong></span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
        <Avatar letter="S" color="#7A5BA6" />
        <span className="flex-1 text-caption font-bold">You owe Sara €42.80</span>
        <Swap from={<span className="rounded-md bg-sommet px-2.5 py-1 text-2xs font-bold text-white">Pay</span>} to={<span className="rounded-md bg-[#3e7a3a] px-2.5 py-1 text-2xs font-bold text-white">✓ Paid</span>} when={1.6} />
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
        <Avatar letter="L" color="#2E8B57" />
        <span className="flex flex-1 flex-col"><span className="text-caption font-bold">Leo owes you €18.00</span><span className="text-2xs text-chemin-dark">Leo marked it paid</span></span>
        <Swap from={<span className="rounded-md border border-line-strong px-2 py-1 text-2xs font-bold">Confirm</span>} to={<span className="rounded-md bg-[#3e7a3a] px-2 py-1 text-2xs font-bold text-white">✓ Done</span>} when={2.6} />
      </div>
    </>
  )
}

const previews = [CreateTrip, Invite, Vote, Dates, Stay, SettleUp]

export function StepPreview({ step }: { step: number }) {
  const Preview = previews[step]
  return <div className="flex flex-col gap-2"><Preview /></div>
}
