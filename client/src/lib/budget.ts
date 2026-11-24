import type { Expense } from '@shared/types'
import { convert, expenseShares } from '@shared/money'

// "€1,284", "€12.50", "IDR 1,050,000"
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, trailingZeroDisplay: 'stripIfInteger' } as Intl.NumberFormatOptions).format(amount)
}

// A MobilePay number as people read it: "+45 12 34 56 78", "+358 40 123 4567"
export function formatPhone(n: string): string {
  if (n.startsWith('+45')) return `+45 ${n.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`
  if (n.startsWith('+358')) return `+358 ${n.slice(4, 6)} ${n.slice(6, 9)} ${n.slice(9)}`.trim()
  return n
}

// What people type: "60", "12,50", "1,050,000" or "1.050.000,50". A single comma or dot with one or two digits
// after it is the decimal point; otherwise commas, dots and spaces only group the thousands. NaN when it is no number.
export function parseAmount(text: string): number {
  const t = text.replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(t)) return NaN
  const last = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'))
  const decimals = last >= 0 && t.length - last - 1 <= 2 ? t.slice(last + 1) : ''
  const whole = (decimals || last === t.length - 1 ? t.slice(0, last) : t).replace(/[.,]/g, '')
  return Number(decimals ? `${whole}.${decimals}` : whole)
}

// The three numbers at the top of the Budget tab, in the group's currency. Expenses whose rate is missing
// are left out of the totals and counted, so the screen can say that the totals are not complete.
export function budgetTotals(expenses: Expense[], me: string, currency: string, rates: Record<string, number>) {
  let spent = 0, paid = 0, share = 0, missing = 0
  for (const e of expenses) {
    const total = convert(e.amount, e.currency, currency, rates)
    if (total === null) { missing++; continue }
    spent += total
    if (e.paidByUserId === me) paid += total
    const mine = expenseShares(e).find(s => s.userId === me)
    if (mine) share += convert(mine.amount, e.currency, currency, rates) ?? 0
  }
  return { spent, paid, share, missing }
}
