import { afterEach, describe, expect, it, vi } from 'vitest';
import { cityAt, cityOfAnswer } from '../src/preview/osm';
import { areaForCity, MAX_AREAS, sameName } from '../src/stays';

describe('cityOfAnswer', () => {
  it('reads the city from a Nominatim answer', () => {
    expect(cityOfAnswer({ address: { city: 'Lisbon', country: 'Portugal' } })).toEqual({ city: 'Lisbon', country: 'Portugal' });
  });

  it('prefers the city to a parish, and drops "District" as in Bali (real answers)', () => {
    expect(cityOfAnswer({ address: { suburb: 'Baixa', village: 'Madalena', city: 'Lisbon', country: 'Portugal' } })?.city).toBe('Lisbon');
    expect(cityOfAnswer({ address: { suburb: 'Ubud', town: 'Ubud District', state: 'Bali', country: 'Indonesia' } })?.city).toBe('Ubud');
    expect(cityOfAnswer({ address: { city: 'Ho Chi Minh City', country: 'Vietnam' } })?.city).toBe('Ho Chi Minh City');
  });

  it('takes a town or a village when there is no city', () => {
    expect(cityOfAnswer({ address: { town: 'Ubud', state: 'Bali', country: 'Indonesia' } })).toEqual({ city: 'Ubud', country: 'Indonesia' });
    expect(cityOfAnswer({ address: { village: 'Duong Dong', country: 'Vietnam' } })?.city).toBe('Duong Dong');
  });

  it('gives nothing for an answer without a place', () => {
    expect(cityOfAnswer({ error: 'Unable to geocode' })).toBeNull();
    expect(cityOfAnswer({ address: { country: 'Vietnam' } })).toBeNull();
    expect(cityOfAnswer(null)).toBeNull();
  });
});

describe('cityAt', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('asks Nominatim in English, names the app, and keeps the answer', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ address: { city: 'Phu Quoc', country: 'Vietnam' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await cityAt(10.2201, 103.9601)).toEqual({ city: 'Phu Quoc', country: 'Vietnam' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('accept-language=en');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^TripPlanner/);
    // A place a few metres away is the same city, answered from memory
    expect(await cityAt(10.2203, 103.9598)).toEqual({ city: 'Phu Quoc', country: 'Vietnam' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives nothing when Nominatim fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 429 })));
    expect(await cityAt(45.1, 13.1)).toBeNull();
  });
});

describe('areaForCity', () => {
  const areas = [{ _id: 'a1', name: 'Ubud' }, { _id: 'a2', name: 'Uluwatu' }];

  it('finds the area with the city name, whatever the case or accents', () => {
    expect(areaForCity(areas, 'ubud')).toEqual(areas[0]);
    expect(areaForCity(areas, ' Ulúwatu ')).toEqual(areas[1]);
    expect(sameName('Phú Quốc', 'phu quoc')).toBe(true);
  });

  it('asks for a new area for a new city, unless the trip already has the most areas', () => {
    expect(areaForCity(areas, 'Canggu')).toBe('new');
    const full = Array.from({ length: MAX_AREAS }, (_, i) => ({ _id: String(i), name: `Area ${i}` }));
    expect(areaForCity(full, 'Canggu')).toBeNull();
  });

  it('leaves a stay without a city out of the areas', () => {
    expect(areaForCity(areas, undefined)).toBeNull();
    expect(areaForCity(areas, '  ')).toBeNull();
  });
});
