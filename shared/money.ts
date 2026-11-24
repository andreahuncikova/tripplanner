// Converting amounts between currencies, used by the client and the server in the same way.
// Rates are how much of each currency one euro buys (GET /api/fx-rates), so every conversion goes through the euro.

// How many decimals a currency has: 2 for euros, 0 for Japanese yen, 3 for Kuwaiti dinars
export function decimals(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

// An amount in another currency, rounded to that currency's decimals. null when a rate is missing,
// so a missing rate never turns into a wrong total.
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return round(amount, to);
  const fromRate = rates[from], toRate = rates[to];
  if (!fromRate || !toRate) return null;
  return round((amount / fromRate) * toRate, to);
}

export function round(amount: number, currency: string): number {
  const factor = 10 ** decimals(currency);
  return Math.round(amount * factor) / factor;
}

// Splits an amount equally. The smallest units (cents) that do not divide evenly go to the first people,
// so the parts always add up to the whole: 10 € for 3 people is 3.34 + 3.33 + 3.33
export function splitEqually(amount: number, count: number, currency: string): number[] {
  if (count < 1) return [];
  const factor = 10 ** decimals(currency);
  const units = Math.round(amount * factor);
  const base = Math.floor(units / count);
  const extra = units - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / factor);
}

export interface ShareLike { userId: string; amount: number }
export interface ExpenseLike {
  amount: number;
  currency: string;
  splitAmongUserIds: string[];
  // Set when the expense is split by exact amounts; otherwise it is split equally
  shares?: ShareLike[];
}

// What each person owes for one expense, in the expense's own currency
export function expenseShares(e: ExpenseLike): ShareLike[] {
  if (e.shares?.length) return e.shares;
  const parts = splitEqually(e.amount, e.splitAmongUserIds.length, e.currency);
  return e.splitAmongUserIds.map((userId, i) => ({ userId, amount: parts[i] }));
}

export interface PaidExpenseLike extends ExpenseLike { paidByUserId: string }
// One payment that settles the trip: `from` pays `to` this amount in the group's currency
export interface Transfer { from: string; to: string; amount: number }

// Who owes whom at the end, in the group's currency, with as few payments as the simple method below gives.
// Each person's balance is what they paid minus their part of each expense, counted in whole cents so nothing is lost
// to rounding. Then the person who owes the most pays the person who is owed the most, until everyone is even.
// Expenses whose exchange rate is missing are left out, as in the totals (client/src/lib/budget.ts).
export function settleUp(expenses: PaidExpenseLike[], currency: string, rates: Record<string, number>): Transfer[] {
  const factor = 10 ** decimals(currency);
  const balance = new Map<string, number>();
  const add = (id: string, units: number) => balance.set(id, (balance.get(id) ?? 0) + units);

  for (const e of expenses) {
    const total = convert(e.amount, e.currency, currency, rates);
    if (total === null) continue;
    const totalUnits = Math.round(total * factor);
    // Each part converted on its own can be a cent off; the biggest part takes the difference,
    // so the parts always add up to exactly what the payer paid
    const parts = expenseShares(e).map(s => ({ id: s.userId, units: Math.round((convert(s.amount, e.currency, currency, rates) ?? 0) * factor) }));
    if (!parts.length) continue;
    const diff = totalUnits - parts.reduce((sum, p) => sum + p.units, 0);
    parts.reduce((a, b) => (b.units > a.units ? b : a)).units += diff;
    add(e.paidByUserId, totalUnits);
    for (const p of parts) add(p.id, -p.units);
  }

  const owes = [...balance].filter(([, u]) => u < 0).map(([id, u]) => ({ id, units: -u }));
  const owed = [...balance].filter(([, u]) => u > 0).map(([id, u]) => ({ id, units: u }));
  const transfers: Transfer[] = [];
  while (owes.length && owed.length) {
    owes.sort((a, b) => b.units - a.units);
    owed.sort((a, b) => b.units - a.units);
    const units = Math.min(owes[0].units, owed[0].units);
    transfers.push({ from: owes[0].id, to: owed[0].id, amount: units / factor });
    owes[0].units -= units;
    owed[0].units -= units;
    if (!owes[0].units) owes.shift();
    if (!owed[0].units) owed.shift();
  }
  return transfers;
}

// The currencies PayPal can take money in; for other currencies the Pay link opens without an amount
export const PAYPAL_CURRENCIES = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'ILS', 'JPY',
  'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'SEK', 'SGD', 'THB', 'TWD', 'USD'];

// The PayPal.Me link that pays this person, with the amount and currency filled in when PayPal takes that currency:
// https://paypal.me/miakarlsen/45.20EUR
export function paypalLink(name: string, amount: number, currency: string): string {
  const base = `https://paypal.me/${encodeURIComponent(name)}`;
  if (!PAYPAL_CURRENCIES.includes(currency)) return base;
  return `${base}/${amount.toFixed(decimals(currency))}${currency}`;
}
