import type { FxRates, FxSource } from '../../shared/types';

// Exchange rates for the budget: how much of each currency one euro buys.
// The old server asked only Frankfurter, which has the 31 currencies of the European Central Bank,
// and the client offered 13 of them. ExchangeRate-API has about 160, so a group can pay in Vietnamese
// dong or Egyptian pounds too. Frankfurter stays as the second source if the first one does not answer.

// The rates change once a day, and ExchangeRate-API blocks a server that asks more than about once an hour,
// so the answer is kept for 6 hours
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

// Codes in the lists that are not money a traveller pays with: units of account (XDR, CLF), the offshore yuan (CNH),
// and old currencies that were replaced (HRK by the euro in 2023, SLL by SLE, ZWL by ZWG)
const NOT_FOR_TRIPS = new Set(['XDR', 'CLF', 'CNH', 'HRK', 'SLL', 'ZWL']);

// Used when no source answers and nothing is cached yet, e.g. right after a restart without internet
const FALLBACK: Record<string, number> = {
  EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.95, CZK: 25.1, PLN: 4.28, HUF: 390,
  NOK: 11.7, SEK: 11.4, DKK: 7.46, JPY: 162, CAD: 1.47, AUD: 1.65,
};

type Source = { name: FxSource; url: string; read: (data: any) => { rates: unknown; date: string } | null };

const SOURCES: Source[] = [
  {
    name: 'exchangerate-api',
    url: 'https://open.er-api.com/v6/latest/EUR',
    read: d => d?.result === 'success'
      ? { rates: d.rates, date: new Date(Number(d.time_last_update_unix) * 1000).toISOString().slice(0, 10) }
      : null,
  },
  {
    // The old address api.frankfurter.app now only redirects here
    name: 'frankfurter',
    url: 'https://api.frankfurter.dev/v1/latest?base=EUR',
    read: d => (d?.rates ? { rates: { EUR: 1, ...d.rates }, date: String(d.date) } : null),
  },
];

// Only three capital letters with a rate above zero, without the codes travellers do not pay with
export function cleanRates(raw: unknown): Record<string, number> {
  const rates: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return rates;
  for (const [code, value] of Object.entries(raw)) {
    const rate = Number(value);
    if (/^[A-Z]{3}$/.test(code) && !NOT_FOR_TRIPS.has(code) && Number.isFinite(rate) && rate > 0) rates[code] = rate;
  }
  if (Object.keys(rates).length) rates.EUR = 1;
  return rates;
}

// The rates with their own memory. fetchFn and now can be replaced in the tests, so they need no internet.
export function createRates(fetchFn: typeof fetch = fetch, now: () => number = Date.now) {
  let cache: { value: FxRates; at: number } | null = null;

  async function load(): Promise<FxRates | null> {
    for (const source of SOURCES) {
      try {
        const res = await fetchFn(source.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const answer = source.read(await res.json());
        const rates = cleanRates(answer?.rates);
        // A source that answers with only a few currencies is treated as broken
        if (!answer || Object.keys(rates).length < 10) throw new Error('no rates in the answer');
        return { base: 'EUR', rates, date: answer.date, source: source.name };
      } catch (e) {
        console.warn(`[fx-rates] ${source.name}:`, (e as Error).message);
      }
    }
    return null;
  }

  return {
    async get(): Promise<FxRates> {
      if (cache && now() - cache.at < CACHE_MS) return cache.value;
      const fresh = await load();
      if (fresh) {
        cache = { value: fresh, at: now() };
        return fresh;
      }
      // Old rates are better than none; they are tried again on the next request
      return cache?.value ?? { base: 'EUR', rates: FALLBACK, date: '', source: 'fallback' };
    },
  };
}

// The one copy the server uses
export const fxRates = createRates();

// Expenses and trips can only use a currency the budget can convert
export async function isKnownCurrency(code: string): Promise<boolean> {
  return code in (await fxRates.get()).rates;
}
