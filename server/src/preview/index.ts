// The link preview used by POST /api/preview and by adding a stay (socket/stays.ts):
// download the page safely, read what it says about itself, remember the answer for an hour.
import { checkLink, fetchPage, PreviewError } from './fetchPage';
import { detailsFromUrl, parsePreview, platformOf } from './parse';
import { findPlace, placePhotoPath } from './places';
import type { LinkPreview } from '../types';

export { checkLink, PreviewError };

// Pages change rarely, and a group often pastes the same link twice, so answers are kept for an hour
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; preview: LinkPreview }>();

function remember(key: string, preview: LinkPreview) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);   // the oldest one
  cache.set(key, { at: Date.now(), preview });
}

// The preview of a link that passed checkLink(). Never throws for a page that cannot be read:
// a bot check, an error page or a timeout give only the platform, with complete false,
// and the user fills in the rest. Throws PreviewError (400) only for a link that may not be opened.
export async function getPreview(link: URL): Promise<LinkPreview> {
  const key = link.href;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.preview;

  try {
    const page = await fetchPage(link);
    // A bot check or an error page has no stay data; parsing it would only give a title like "Just a moment…"
    const preview: LinkPreview = page.status >= 200 && page.status < 300 && page.status !== 202
      ? parsePreview(page.html, page.url)
      : { url: page.url, platform: platformOf(page.url), complete: false };
    const filled = await withPlacePhoto(withUrlDetails(preview));
    remember(key, filled);
    return filled;
  } catch (e) {
    if (e instanceof PreviewError && e.status === 400) throw e;
    if (!(e instanceof PreviewError)) console.error('[preview]', (e as Error).message);
    return withPlacePhoto(withUrlDetails({ url: link.href, platform: platformOf(link.href), complete: false }));
  }
}

// No photo on the page (Booking): the photo of the place on Google Maps, found by its name and location.
// Only when GOOGLE_PLACES_KEY is set; see places.ts for what may be kept.
async function withPlacePhoto(p: LinkPreview): Promise<LinkPreview> {
  if (p.image || !p.title || p.platform === 'other') return p;
  const place = await findPlace([p.title, p.location].filter(Boolean).join(', '));
  if (!place) return p;
  return { ...p, image: placePhotoPath(place.placeId), placeId: place.placeId, imageCredit: place.credit };
}

// When the page gave no title or location, take what the address tells (only Booking addresses carry them)
function withUrlDetails(p: LinkPreview): LinkPreview {
  if (p.title && p.location) return p;
  const fromUrl = detailsFromUrl(p.url);
  return { ...fromUrl, ...p, title: p.title ?? fromUrl.title, location: p.location ?? fromUrl.location };
}

// Every preview downloads someone else's page, so one user may start at most 30 in 10 minutes,
// counted together for stays added in the Stays tab and links sent in the chat
const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const recent = new Map<string, number[]>();

export function allowPreview(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter(t => now - t < LIMIT_WINDOW_MS);
  if (list.length >= LIMIT) { recent.set(userId, list); return false; }
  list.push(now);
  recent.set(userId, list);
  return true;
}

// The first web link in a chat message, without a full stop or bracket right after it
export function firstLink(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}
