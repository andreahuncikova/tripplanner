import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coversEnabled, findCover } from '../src/covers';

// Unsplash is never called: fetch is replaced by answers like the Unsplash API gives
const PHOTO = {
  urls: { raw: 'https://images.unsplash.com/photo-123?ixid=abc' },
  user: { name: 'Ana Costa', links: { html: 'https://unsplash.com/@anacosta' } },
  links: { download_location: 'https://api.unsplash.com/photos/123/download?ixid=abc' },
};
function fakeUnsplash(results: unknown[] = [PHOTO], status = 200) {
  return vi.fn(async (url: string) => {
    if (url.includes('/search/photos')) return new Response(JSON.stringify({ results }), { status });
    return new Response('{}', { status: 200 });
  });
}

describe('destination photos from Unsplash', () => {
  beforeEach(() => { vi.stubEnv('UNSPLASH_ACCESS_KEY', 'test-key'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('finds a portrait photo, sizes it for a card and links to the photographer', async () => {
    const fetch = fakeUnsplash();
    vi.stubGlobal('fetch', fetch);
    const cover = await findCover('Lisbon');
    expect(cover).toEqual({
      url: expect.stringMatching(/^https:\/\/images\.unsplash\.com\/photo-123\?ixid=abc&w=640&h=854&fit=crop/),
      author: 'Ana Costa',
      authorUrl: 'https://unsplash.com/@anacosta?utm_source=tripplanner&utm_medium=referral',
    });
    const search = new URL(fetch.mock.calls[0][0]);
    expect(search.searchParams.get('query')).toBe('Lisbon');
    expect(search.searchParams.get('orientation')).toBe('portrait');
    // Unsplash is told that the photo is used
    expect(fetch.mock.calls.some(([u]) => String(u).startsWith('https://api.unsplash.com/photos/123/download'))).toBe(true);
  });

  it('gives no photo when nothing is found, or the answer points somewhere else', async () => {
    vi.stubGlobal('fetch', fakeUnsplash([]));
    expect(await findCover('Nowhere')).toBeNull();
    vi.stubGlobal('fetch', fakeUnsplash([{ ...PHOTO, urls: { raw: 'https://evil.example/photo.jpg' } }]));
    expect(await findCover('Lisbon')).toBeNull();
  });

  it('throws when Unsplash does not answer, so the trip tries again later', async () => {
    vi.stubGlobal('fetch', fakeUnsplash([], 403));
    await expect(findCover('Lisbon')).rejects.toThrow('Unsplash 403');
  });

  it('does nothing without a key', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('UNSPLASH_ACCESS_KEY', '');
    const fetch = fakeUnsplash();
    vi.stubGlobal('fetch', fetch);
    expect(coversEnabled()).toBe(false);
    expect(await findCover('Lisbon')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
