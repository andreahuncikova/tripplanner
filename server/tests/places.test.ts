import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findPlace, isPlaceId, photoUri, placePhotoPath, placesEnabled } from '../src/preview/places';

// Google is never called: fetch is replaced by answers like the Places API (New) gives
const PLACE = 'ChIJ_freebeach_123';
function fakeGoogle() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.endsWith('/places:searchText')) {
      expect(JSON.parse(String(init?.body)).textQuery).toBe('Freebeach, Vietnam');
      return json({ places: [{ id: PLACE, photos: [{ name: `places/${PLACE}/photos/p1`, authorAttributions: [{ displayName: 'Lan Nguyen' }] }] }] });
    }
    if (url.endsWith(`/places/${PLACE}`)) return json({ photos: [{ name: `places/${PLACE}/photos/p1` }] });
    if (url.includes('/photos/p1/media')) return json({ photoUri: 'https://lh3.googleusercontent.com/p/photo-1' });
    return new Response('{}', { status: 404 });
  });
}

describe('Google Maps photos', () => {
  beforeEach(() => { vi.stubEnv('GOOGLE_PLACES_KEY', 'test-key'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('finds the place by name and country and names the photo author', async () => {
    vi.stubGlobal('fetch', fakeGoogle());
    expect(await findPlace('Freebeach, Vietnam')).toEqual({ placeId: PLACE, credit: 'Photo: Lan Nguyen · Google Maps' });
  });

  it('gets a fresh photo address only when asked, and keeps it for a while', async () => {
    const fetch = fakeGoogle();
    vi.stubGlobal('fetch', fetch);
    expect(await photoUri(PLACE)).toBe('https://lh3.googleusercontent.com/p/photo-1');
    const calls = fetch.mock.calls.length;
    expect(await photoUri(PLACE)).toBe('https://lh3.googleusercontent.com/p/photo-1');
    expect(fetch.mock.calls.length).toBe(calls);   // the second time from memory
  });

  it('gives nothing when Google fails, instead of breaking the stay', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota', { status: 429 })));
    expect(await findPlace('Somewhere, Nowhere')).toBeNull();
  });

  it('is off without a key', async () => {
    vi.stubEnv('GOOGLE_PLACES_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(placesEnabled()).toBe(false);
    expect(await findPlace('Freebeach, Vietnam')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('only accepts place ids that look like Google ones', () => {
    expect(isPlaceId(PLACE)).toBe(true);
    expect(isPlaceId('../../etc/passwd')).toBe(false);
    expect(isPlaceId('x')).toBe(false);
    expect(placePhotoPath(PLACE)).toBe(`/api/places/${PLACE}/photo`);
  });
});
