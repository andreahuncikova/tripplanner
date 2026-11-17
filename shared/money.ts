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
