import { useState } from 'react'
import type { Expense, Member, TripState } from '@shared/types'
import { useAuth } from '../../../auth/useAuth'
import { budgetTotals, formatMoney } from '../../../lib/budget'
import { convert, paypalLink, PAYPAL_CURRENCIES, settleUp, type Transfer } from '@shared/money'
import { useFxRates } from '../../../lib/currencies'
import { cn } from '../../../lib/cn'
import type { TripPlan } from '../../../socket/useTripPlan'
import { Avatar, Button } from '../../../components/ui'
import ExpenseDialog from './ExpenseDialog'

// The Budget tab from the mockups: what the group spent, what you paid and your share, and the list of expenses.
// Every amount is shown in the group's currency; an expense in another currency also shows what was really paid.
// Settle up says who pays whom so that everyone has paid their part, with a Pay button for your own debts.
export default function BudgetSection({ plan }: { plan: TripPlan }) {
  const { user } = useAuth()
  const fx = useFxRates()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const state = plan.state
  if (!state || !user) return <p className="text-muted">Loading the budget…</p>

  if (state.phase !== 'done') {
    return (
      <p className="rounded-lg bg-white p-4 text-sm text-subtle">
        The budget opens when the group has agreed on the destination and the dates.
      </p>
    )
  }

  const currency = state.currency
  const rates = fx?.rates ?? {}
  const totals = budgetTotals(state.expenses, user._id, currency, rates)
  const name = (id: string) => (id === user._id ? 'You' : state.members.find(m => m.userId === id)?.username ?? 'Someone who left')
  // The same rule as on the server: the author, or the organiser when the author has left the trip
  const mayChange = (e: Expense) => e.addedByUserId === user._id
    || (state.adminUserId === user._id && !state.members.some(m => m.userId === e.addedByUserId))

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:gap-3.5">
        <div className="flex flex-col gap-3.5 rounded-xl bg-sommet p-4.5 text-white lg:flex-[2_1_260px] lg:gap-1.5 lg:px-5">
          <span className="text-caption text-line-strong">Group spent</span>
          <strong className="text-[32px] font-extrabold tracking-tight">{fx ? formatMoney(totals.spent, currency) : '…'}</strong>
          {/* Phones: the two numbers inside the dark card. Desktop: white cards next to it */}
          <div className="flex gap-2.5 lg:hidden">
            <Tile label="You paid" value={fx ? formatMoney(totals.paid, currency) : '…'} dark />
            <Tile label="Your share" value={fx ? formatMoney(totals.share, currency) : '…'} dark />
          </div>
        </div>
        <div className="hidden lg:contents">
          <Tile label="You paid" value={fx ? formatMoney(totals.paid, currency) : '…'} />
          <Tile label="Your share" value={fx ? formatMoney(totals.share, currency) : '…'} />
        </div>
      </div>
      {totals.missing > 0 && (
        <p className="text-caption text-chemin-dark">{totals.missing} {totals.missing === 1 ? 'expense is' : 'expenses are'} not in the totals, because the exchange rate is missing right now.</p>
      )}

      {state.expenses.length > 0 && (
        <SettleUp transfers={settleUp(state.expenses, currency, rates)} me={user._id} members={state.members} currency={currency} name={name} />
      )}

      <section aria-labelledby="expenses-title" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 id="expenses-title" className="text-base font-extrabold lg:text-[17px]">Expenses</h2>
          <Button variant="dark" size="sm" onClick={() => setAdding(true)}>+ Add expense</Button>
        </div>
        {state.expenses.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-muted">No expenses yet. Add the first one, for example the stay or the car.</p>
        ) : (
          <ul className="flex flex-col rounded-lg bg-white">
            {[...state.expenses].reverse().map(e => (
              <ExpenseRow
                key={e._id}
                expense={e}
                currency={currency}
                rates={rates}
                payer={name(e.paidByUserId)}
                groupSize={state.members.length}
                onEdit={mayChange(e) ? () => setEditing(e) : undefined}
              />
            ))}
          </ul>
        )}
        <p className="text-caption text-muted">Only the person who added an expense can edit or delete it.</p>
      </section>

      <ExpenseDialog open={adding} onClose={() => setAdding(false)} plan={plan} state={state as TripState} me={user._id} rates={rates} />
      <ExpenseDialog open={editing !== null} onClose={() => setEditing(null)} expense={editing ?? undefined} plan={plan} state={state as TripState} me={user._id} rates={rates} />
    </div>
  )
}

function Tile({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return dark ? (
    <div className="flex flex-1 flex-col rounded-md bg-white/10 px-3 py-2.5">
      <span className="text-xs text-line-strong">{label}</span><strong>{value}</strong>
    </div>
  ) : (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white px-5 py-4.5 lg:flex-[1_1_160px]">
      <span className="text-caption text-muted">{label}</span><strong className="text-2xl">{value}</strong>
    </div>
  )
}

// Who pays whom at the end of the trip. Your own payments come first: what you owe has a Pay button that opens
// the other person's PayPal.Me link with the amount, what you are owed says who pays you. The others' payments follow.
function SettleUp({ transfers, me, members, currency, name }: {
  transfers: Transfer[]; me: string; members: Member[]; currency: string; name: (id: string) => string
}) {
  const mine = transfers.filter(t => t.from === me || t.to === me)
  const others = transfers.filter(t => t.from !== me && t.to !== me)
  return (
    <section aria-labelledby="settle-title" className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 id="settle-title" className="text-base font-extrabold lg:text-[17px]">Settle up</h2>
        <p className="text-caption text-muted">Who pays whom, so everyone has paid their part — in as few payments as possible.</p>
      </div>
      {transfers.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm font-semibold text-success">Everyone is even — nobody owes anything.</p>
      ) : (
        <ul className="flex flex-col rounded-lg bg-white">
          {[...mine, ...others].map(t => (
            <TransferRow key={`${t.from}-${t.to}`} transfer={t} me={me} members={members} currency={currency} name={name} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TransferRow({ transfer: t, me, members, currency, name }: {
  transfer: Transfer; me: string; members: Member[]; currency: string; name: (id: string) => string
}) {
  const iPay = t.from === me
  const other = members.find(m => m.userId === (iPay ? t.to : t.from))
  const payee = members.find(m => m.userId === t.to)
  const text = iPay ? <>You owe <strong>{name(t.to)}</strong></>
    : t.to === me ? <><strong>{name(t.from)}</strong> owes you</>
    : <><strong>{name(t.from)}</strong> owes <strong>{name(t.to)}</strong></>
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0 lg:px-4">
      <Avatar name={other?.username ?? '?'} color={other?.color ?? '#8a96a6'} photo={other?.photo} size="sm" />
      <span className={cn('min-w-0 flex-1 text-md', !iPay && t.to !== me && 'text-subtle')}>{text}</span>
      <span className="font-bold">{formatMoney(t.amount, currency)}</span>
      {iPay && (payee?.paypalMe ? (
        <a
          href={paypalLink(payee.paypalMe, t.amount, currency)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Pay ${name(t.to)} ${formatMoney(t.amount, currency)} with PayPal`}
          className="inline-flex h-9 items-center rounded-md bg-sommet px-4 text-sm font-bold text-white no-underline hover:bg-sommet-dark hover:text-white"
        >
          Pay
        </a>
      ) : (
        <span className="w-full text-caption text-muted lg:w-auto">
          {payee ? `${name(t.to)} has not added a PayPal.Me link yet` : 'This person has left the trip'}
        </span>
      ))}
      {iPay && payee?.paypalMe && !PAYPAL_CURRENCIES.includes(currency) && (
        <span className="w-full text-caption text-muted">PayPal does not take {currency}, so type the amount in PayPal yourself.</span>
      )}
    </li>
  )
}

function ExpenseRow({ expense: e, currency, rates, payer, groupSize, onEdit }: {
  expense: Expense; currency: string; rates: Record<string, number>; payer: string; groupSize: number; onEdit?: () => void
}) {
  const inGroupCurrency = e.currency === currency ? e.amount : convert(e.amount, e.currency, currency, rates)
  const split = e.shares?.length
    ? `exact amounts, ${e.shares.length} ${e.shares.length === 1 ? 'person' : 'people'}`
    : e.splitAmongUserIds.length === groupSize ? 'split between everyone' : `split ${e.splitAmongUserIds.length} ways`
  return (
    <li className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0 lg:px-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-md">{e.description}</strong>
        <span className="text-caption text-muted">
          {payer} paid · {split}{e.currency !== currency && ` · ${formatMoney(e.amount, e.currency)}`}
        </span>
      </div>
      <span className="font-bold">{inGroupCurrency === null ? formatMoney(e.amount, e.currency) : formatMoney(inGroupCurrency, currency)}</span>
      {/* An empty space of the same size for the others' expenses, so the amounts stay in one column */}
      {onEdit ? (
        <button type="button" onClick={onEdit} aria-label={`Edit ${e.description}`} className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-subtle hover:text-roche">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
        </button>
      ) : <span aria-hidden="true" className="size-9 shrink-0" />}
    </li>
  )
}
