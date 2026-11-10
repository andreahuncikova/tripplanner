import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { NewTripInput } from '@shared/types'
import { api } from '../lib/api'
import { useCurrencies } from '../lib/currencies'
import { cn } from '../lib/cn'
import { Button, Input } from '../components/ui'
import { BackIcon } from '../components/layout/icons'

type DatesMode = NewTripInput['dates']['mode']

// Same limit as the server (server/src/validation.ts)
const MAX_WINDOW_MONTHS = 12

const pad = (n: number) => String(n).padStart(2, '0')
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

// This month and the next 23, as options like { value: "2027-03", label: "March 2027" }
function nextMonths(count: number) {
  const now = new Date()
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return { value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: label.format(d) }
  })
}
const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5)) - Number(from.slice(5)) + 1

// "New trip" from the mockups. Known dates skip availability and the date vote, an empty destination
// starts with the destination poll, and the group's currency is used in the budget.
export default function NewTrip() {
  const navigate = useNavigate()
  const months = useMemo(() => nextMonths(24), [])
  const currencies = useCurrencies()
  const [mode, setMode] = useState<DatesMode>('known')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [fromMonth, setFromMonth] = useState(months[1].value)
  const [toMonth, setToMonth] = useState(months[3].value)
  const [currency, setCurrency] = useState('EUR')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const today = todayKey()
  const currencyId = useId()
  const fieldId = useId()   // ids for the From/To fields, so each label is linked to its field

  // The last month can only be the first month or later, and at most 12 months in total
  const toOptions = months.filter(m => m.value >= fromMonth && monthsBetween(fromMonth, m.value) <= MAX_WINDOW_MONTHS)

  function changeFrom(value: string) {
    setFromMonth(value)
    if (toMonth < value || monthsBetween(value, toMonth) > MAX_WINDOW_MONTHS) setToMonth(value)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body: NewTripInput = {
      name: String(form.get('name')),
      destination: String(form.get('destination')),
      dates: mode === 'known' ? { mode, start, end } : { mode, fromMonth, toMonth },
      currency,
    }
    setError('')
    setBusy(true)
    try {
      const { inviteCode } = await api<{ inviteCode: string }>('/api/groups', { method: 'POST', body: JSON.stringify(body) })
      // The trip opens with "Invite friends", as in the mockups
      navigate(`/trips/${inviteCode}`, { state: { invite: true } })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:min-h-0 lg:flex-1 lg:items-center lg:bg-canvas lg:px-6 lg:py-12">
      <form onSubmit={onSubmit} className="flex flex-1 flex-col lg:w-full lg:max-w-[720px] lg:flex-none lg:gap-6.5 lg:rounded-[24px] lg:bg-white lg:px-10 lg:py-9 lg:shadow-card">
        <header className="flex items-center gap-1 px-3 pt-3 pb-2 lg:flex-col lg:items-start lg:gap-1.5 lg:p-0">
          <Link to="/dashboard" aria-label="Back to your trips" className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
            <BackIcon />
          </Link>
          <h1 className="text-xl font-extrabold lg:text-heading">New trip</h1>
          <p className="hidden text-muted lg:block">You can change everything later in Trip settings.</p>
        </header>

        <div className="flex flex-1 flex-col gap-5.5 px-5 pt-2 pb-5 lg:gap-6.5 lg:p-0">
          <div className="flex flex-col gap-5.5 lg:flex-row lg:gap-5">
            <div className="lg:flex-1"><Input label="Trip name" name="name" required maxLength={60} autoComplete="off" /></div>
            <div className="lg:flex-1">
              <Input
                label="Destination"
                name="destination"
                maxLength={60}
                autoComplete="off"
                placeholder="Leave empty and let the group vote"
                hint="Empty = everyone suggests places and votes."
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="pb-2.5 text-md font-bold">When are you going?</legend>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-start lg:gap-3">
              <DateOption
                checked={mode === 'known'}
                onSelect={() => setMode('known')}
                title="We know our dates"
                text="Skip availability and date voting."
                wide={false}
              >
                <div className="flex gap-2.5">
                  <SmallField label="From" id={`${fieldId}-start`}>
                    <input id={`${fieldId}-start`} type="date" required value={start} min={today} onChange={e => { setStart(e.target.value); if (end && end < e.target.value) setEnd('') }} className={fieldClass} />
                  </SmallField>
                  <SmallField label="To" id={`${fieldId}-end`}>
                    <input id={`${fieldId}-end`} type="date" required value={end} min={start || today} onChange={e => setEnd(e.target.value)} className={fieldClass} />
                  </SmallField>
                </div>
              </DateOption>

              <DateOption
                checked={mode === 'find'}
                onSelect={() => setMode('find')}
                title="Help us find dates"
                text={mode === 'find' ? 'Which months could work for the trip?' : "Pick a range of months; everyone marks the days they can't go."}
                wide
              >
                <div className="flex flex-col gap-3.5">
                  <div className="flex gap-2.5">
                    <SmallField label="From" id={`${fieldId}-from`}>
                      <select id={`${fieldId}-from`} value={fromMonth} onChange={e => changeFrom(e.target.value)} className={fieldClass}>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </SmallField>
                    <SmallField label="To" id={`${fieldId}-to`}>
                      <select id={`${fieldId}-to`} value={toMonth} onChange={e => setToMonth(e.target.value)} className={fieldClass}>
                        {toOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </SmallField>
                  </div>
                  {/* Phones: one sentence. Desktop: the three steps, as in the mockups */}
                  <p className="flex items-start gap-2.5 text-caption/[1.45] text-subtle lg:hidden">
                    <InfoIcon />
                    Next, everyone taps the days they can't travel. We show the windows when all of you are free, and you vote on one.
                  </p>
                  <div className="hidden flex-col gap-2 border-t border-[#c3e3ea] pt-3 lg:flex">
                    <span className="text-xs font-bold tracking-[0.06em] text-subtle uppercase">What happens next</span>
                    <ol className="flex flex-col gap-2 text-sm">
                      {["Everyone clicks the days they can't travel.", 'We show the windows when all of you are free.', 'You vote on one, and the trip has its dates.'].map((step, i) => (
                        <li key={step} className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-sommet">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </DateOption>
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 lg:max-w-80">
            <label htmlFor={currencyId} className="text-md font-bold">Group currency</label>
            <select id={currencyId} value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-md border border-line-strong bg-white px-4 py-3.5 text-base text-roche focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none">
              {currencies.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>

          {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        </div>

        {/* Phones: the button stays at the bottom of the screen. Desktop: Cancel and the button under the form */}
        <div className="sticky bottom-0 border-t border-line bg-white px-5 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] lg:static lg:flex lg:items-center lg:justify-end lg:gap-3 lg:px-0 lg:pt-5.5 lg:pb-0">
          <Link to="/dashboard" className="hidden px-4.5 py-3.5 font-semibold text-roche hover:text-roche lg:inline">Cancel</Link>
          <Button type="submit" size="lg" fullWidth disabled={busy} className="rounded-[14px] lg:w-auto lg:rounded-md">
            {busy ? 'Creating trip…' : 'Create trip and invite friends'}
          </Button>
        </div>
      </form>
    </div>
  )
}

const fieldClass = 'w-full rounded-[10px] border border-line-strong bg-white p-3 text-md text-roche focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none'

// One of the two choices under "When are you going?". The chosen one is highlighted and shows its fields.
function DateOption({ checked, onSelect, title, text, wide, children }: {
  checked: boolean; onSelect: () => void; title: string; text: string; wide: boolean; children: ReactNode
}) {
  return (
    <div className={cn(
      'flex flex-col gap-3.5 rounded-lg',
      // 2 px border when chosen, 1 px otherwise; the padding makes up the difference, so the card does not jump
      checked ? 'border-2 border-sommet bg-ciel-light p-[15px] lg:p-[17px]' : 'border border-line-strong p-4 lg:p-4.5',
      checked && wide ? 'lg:flex-[2_1_340px]' : 'lg:flex-[1_1_240px]',
    )}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="radio" name="dates-mode" checked={checked} onChange={onSelect} className="mt-0.5 size-5 shrink-0 accent-sommet" />
        <span className="flex flex-col gap-0.5">
          <strong>{title}</strong>
          <span className="text-sm text-subtle">{text}</span>
        </span>
      </label>
      {checked && children}
    </div>
  )
}

// A small label above a date or month field. Linked by id (not by wrapping), because a <select>
// inside its <label> would make screen readers read every month as part of the label.
function SmallField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold text-subtle">{label}</label>
      {children}
    </div>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-px shrink-0 text-sommet">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" />
    </svg>
  )
}
