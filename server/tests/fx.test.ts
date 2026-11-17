import { describe, it, expect, vi } from 'vitest';
import { cleanRates, createRates } from '../src/fx';
import { convert, decimals } from '../../shared/money';

// Answers shaped like the real APIs, with more than 10 currencies so they count as complete
const many = Object.fromEntries(['USD', 'DKK', 'GBP', 'SEK', 'NOK', 'CHF', 'PLN', 'CZK', 'HUF', 'JPY', 'VND'].map((c, i) => [c, i + 2]));
const erApi = { result: 'success', time_last_update_unix: 1794873751, rates: { EUR: 1, ...many, XDR: 0.8, HRK: 7.5 } };
const frankfurter = { date: '2026-11-17', rates: many };

const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const failing = () => Promise.reject(new Error('offline'));

describe('cleanRates', () => {
  it('keeps currency codes with a rate above zero and sets the euro to 1', () => {
    expect(cleanRates({ USD: '1.08', eur: 1, BAD: -2, NOPE: 1, VND: 27000 })).toEqual({ USD: 1.08, VND: 27000, EUR: 1 });
  });

  it('leaves out codes that are not money a traveller pays with', () => {
    expect(cleanRates({ DKK: 7.46, XDR: 0.8, HRK: 7.5, CNH: 7.7 })).toEqual({ DKK: 7.46, EUR: 1 });
  });

  it('gives nothing for an answer that is not a list of rates', () => {
    expect(cleanRates(null)).toEqual({});
    expect(cleanRates('rates')).toEqual({});
  });
});

describe('createRates', () => {
  it('uses ExchangeRate-API first', async () => {
    const fetchFn = vi.fn(() => reply(erApi));
    const fx = await createRates(fetchFn as unknown as typeof fetch).get();
    expect(fx).toMatchObject({ base: 'EUR', source: 'exchangerate-api', date: '2026-11-17' });
    expect(fx.rates.VND).toBe(12);
    expect(fx.rates.XDR).toBeUndefined();
  });

  it('asks Frankfurter when ExchangeRate-API fails or answers with an error', async () => {
    for (const first of [failing, () => reply({ result: 'error', 'error-type': 'unknown' }), () => reply({}, 429)]) {
      const fetchFn = vi.fn().mockImplementationOnce(first).mockImplementationOnce(() => reply(frankfurter));
      const fx = await createRates(fetchFn as unknown as typeof fetch).get();
      expect(fx).toMatchObject({ source: 'frankfurter', date: '2026-11-17' });
      expect(fx.rates.EUR).toBe(1);
    }
  });

  it('asks again only after 6 hours', async () => {
    let time = 0;
    const fetchFn = vi.fn(() => reply(erApi));
    const fx = createRates(fetchFn as unknown as typeof fetch, () => time);
    await fx.get();
    time = 5 * 60 * 60 * 1000;
    await fx.get();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    time = 7 * 60 * 60 * 1000;
    await fx.get();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps the old rates when both sources fail later', async () => {
    let time = 0;
    const fetchFn = vi.fn().mockImplementationOnce(() => reply(erApi)).mockImplementation(failing);
    const fx = createRates(fetchFn as unknown as typeof fetch, () => time);
    await fx.get();
    time = 7 * 60 * 60 * 1000;
    expect(await fx.get()).toMatchObject({ source: 'exchangerate-api' });
  });

  it('falls back to the built-in rates when nothing has ever answered', async () => {
    const fx = await createRates(failing as unknown as typeof fetch).get();
    expect(fx.source).toBe('fallback');
    expect(fx.rates.DKK).toBeGreaterThan(0);
  });
});

describe('convert', () => {
  const rates = { EUR: 1, DKK: 7.46, JPY: 162, KWD: 0.33 };

  it('goes through the euro and rounds to the decimals of the currency', () => {
    expect(convert(100, 'EUR', 'DKK', rates)).toBe(746);
    expect(convert(746, 'DKK', 'EUR', rates)).toBe(100);
    expect(convert(10, 'EUR', 'JPY', rates)).toBe(1620);
    expect(convert(7.46, 'DKK', 'JPY', rates)).toBe(162);
  });

  it('knows that yen have no decimals and Kuwaiti dinars have three', () => {
    expect(decimals('JPY')).toBe(0);
    expect(decimals('EUR')).toBe(2);
    expect(decimals('KWD')).toBe(3);
  });

  it('gives null instead of a wrong amount when a rate is missing', () => {
    expect(convert(10, 'EUR', 'VND', rates)).toBeNull();
  });
});
