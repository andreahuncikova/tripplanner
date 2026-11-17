import { useId, useState, type FormEvent } from 'react'
import type { ExpenseInput, TripState } from '@shared/types'
import { convert, decimals, splitEqually } from '@shared/money'
import { cn } from '../../../lib/cn'
import { formatMoney, parseAmount } from '../../../lib/budget'
import { useCurrencies } from '../../../lib/currencies'
import type { TripPlan } from '../../../socket/useTripPlan'
import { Avatar, Button, Input, Modal, useToast } from '../../../components/ui'

type Mode = 'equal' | 'exact'

// "Add expense" from the mockups: a sheet on phones, a dialog on desktop. The cost is split equally between the
// chosen members, or by exact amounts, which must add up to the whole before the expense can be saved.
// The old app could only split equally. The server checks the same rules again (validation.ts).
export default function AddExpense({ open, onClose, ...props }: {
  open: boolean; onClose: () => void; plan: TripPlan; state: TripState; me: string; rates: Record<string, number>
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add expense">
      {/* Rendered only while open, so every expense starts from an empty form */}
      {open && <ExpenseForm {...props} onDone={onClose} />}
    </Modal>
  )
}

function ExpenseForm({ plan, state, me, rates, onDone }: {
  plan: TripPlan; state: TripState; me: string; rates: Record<string, number>; onDone: () => void
}) {
  const toast = useToast()
  const { options } = useCurrencies()
  const currencyId = useId()
  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState(state.currency)
  const [payer, setPayer] = useState(me)
  const [mode, setMode] = useState<Mode>('equal')
  const [chosen, setChosen] = useState<string[]>(state.members.map(m => m.userId))
  const [exact, setExact] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const amount = parseAmount(amountText)
  const hasAmount = Number.isFinite(amount) && amount > 0
  const factor = 10 ** decimals(currency)
  const money = (n: number) => formatMoney(n, currency)
  const label = (id: string, name: string) => (id === me ? 'You' : name)

  // Equal split: each chosen member's part, with the leftover cents going to the first ones
  const equalParts = hasAmount ? splitEqually(amount, chosen.length, currency) : []
  // Exact split: how much is still missing (above 0) or too much (below 0), counted in cents
  const exactUnits = state.members.reduce((sum, m) => sum + Math.round((parseAmount(exact[m.userId] || '0') || 0) * factor), 0)
  const leftUnits = hasAmount ? Math.round(amount * factor) - exactUnits : 0
  const ready = hasAmount && description.trim() !== '' && (mode === 'equal' ? chosen.length > 0 : leftUnits === 0)
  const converted = hasAmount && currency !== state.currency ? convert(amount, currency, state.currency, rates) : null

  function toggle(id: string) {
    setChosen(list => (list.includes(id) ? list.filter(x => x !== id) : state.members.map(m => m.userId).filter(x => x === id || list.includes(x))))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    const input: ExpenseInput = {
      description, amount, currency, paidByUserId: payer,
      splitAmongUserIds: mode === 'equal' ? chosen : [],
      ...(mode === 'exact' && {
        shares: state.members.map(m => ({ userId: m.userId, amount: parseAmount(exact[m.userId] || '0') || 0 })).filter(s => s.amount > 0),
      }),
    }
    setError('')
    setBusy(true)
    const problem = await plan.addExpense(input)
    setBusy(false)
    if (problem) return setError(problem)
    toast('Expense added')
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input label="What was it?" value={description} onChange={e => setDescription(e.target.value)} maxLength={80} required autoComplete="off" placeholder="Scooter rental" />

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2.5">
          <div className="min-w-0 flex-[2_1_0]">
            <Input label="Amount" value={amountText} onChange={e => setAmountText(e.target.value)} inputMode="decimal" required autoComplete="off" placeholder="0" className="text-lg font-bold" />
          </div>
          <div className="flex min-w-0 flex-[1_1_0] flex-col gap-2">
            <label htmlFor={currencyId} className="text-sm font-bold">Currency</label>
            <select id={currencyId} value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-md border border-line-strong bg-white px-2.5 py-3.5 text-base text-roche focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none">
              {options.map(c => <option key={c.code} value={c.code} title={c.label}>{c.code}</option>)}
            </select>
          </div>
        </div>
        {amountText && !hasAmount && <span className="text-caption text-danger">Please enter an amount above zero.</span>}
        {converted !== null && <span className="text-caption text-muted">≈ {formatMoney(converted, state.currency)} at today's rate</span>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-bold">Paid by</legend>
        <div className="flex flex-wrap gap-2">
          {state.members.map(m => (
            <label key={m.userId} className={cn(
              'flex cursor-pointer items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm has-focus-visible:outline-2 has-focus-visible:outline-sommet',
              payer === m.userId ? 'border-2 border-sommet bg-ciel-light font-bold' : 'border border-line-strong font-semibold',
            )}>
              <input type="radio" name="payer" value={m.userId} checked={payer === m.userId} onChange={() => setPayer(m.userId)} className="sr-only" />
              <Avatar name={m.username} color={m.color} size="sm" />
              {label(m.userId, m.username)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5 rounded-lg border border-line p-3.5">
        <legend className="px-1.5 text-sm font-bold">Split between</legend>
        <div role="radiogroup" aria-label="How to split" className="flex rounded-md bg-canvas p-1">
          {(['equal', 'exact'] as const).map(m => (
            <label key={m} className={cn('flex-1 cursor-pointer rounded-[9px] p-2 text-center text-sm has-focus-visible:outline-2 has-focus-visible:outline-sommet', mode === m ? 'bg-white font-bold text-roche shadow-card' : 'font-semibold text-muted')}>
              <input type="radio" name="split" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              {m === 'equal' ? 'Equally' : 'Exact amounts'}
            </label>
          ))}
        </div>

        {mode === 'equal' ? state.members.map(m => {
          const i = chosen.indexOf(m.userId)
          return (
            <label key={m.userId} className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={i >= 0} onChange={() => toggle(m.userId)} className="size-5 accent-sommet" />
              {label(m.userId, m.username)}
              <span className="ml-auto text-muted">{i >= 0 && hasAmount ? money(equalParts[i]) : '–'}</span>
            </label>
          )
        }) : (
          <>
            {state.members.map(m => (
              <div key={m.userId} className="flex items-center gap-2.5">
                <label htmlFor={`share-${m.userId}`} className="flex-1">{label(m.userId, m.username)}</label>
                <input
                  id={`share-${m.userId}`}
                  value={exact[m.userId] ?? ''}
                  onChange={e => setExact(x => ({ ...x, [m.userId]: e.target.value }))}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="w-32 rounded-md border border-line-strong px-3 py-2 text-right text-base focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none"
                />
              </div>
            ))}
            {/* Read aloud when it changes, so a screen reader user hears when the amounts add up */}
            <p aria-live="polite" className={cn('text-sm font-semibold', !hasAmount ? 'text-muted' : leftUnits === 0 ? 'text-success' : leftUnits > 0 ? 'text-chemin-dark' : 'text-danger')}>
              {!hasAmount ? 'Enter the amount first.'
                : leftUnits === 0 ? 'The amounts add up ✓'
                : leftUnits > 0 ? `${money(leftUnits / factor)} left to split`
                : `${money(-leftUnits / factor)} too much`}
            </p>
          </>
        )}
      </fieldset>

      {error && <p role="alert" className="rounded-md bg-danger-light px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth pill disabled={!ready || busy}>{busy ? 'Adding…' : 'Add expense'}</Button>
    </form>
  )
}
