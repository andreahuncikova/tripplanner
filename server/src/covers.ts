// A photo of the destination for the trip cards on the dashboard, from Unsplash.
// Only on when UNSPLASH_ACCESS_KEY is set (server/.env locally, Environment on Render); without it the cards
// show a coloured background instead.
//
// Each trip searches once, when the dashboard first lists it with a destination. Unsplash allows keeping the photo's
// address, so it is saved with the trip, and the browser loads the photo from Unsplash directly: those loads do not
// count against the limit (50 searches an hour for a new app). The card must name the photographer and Unsplash,
// with links to both, and the API asks to be told when a photo is used (download_location).
import type { TripCover } from '../../shared/types';

const API = 'https://api.unsplash.com';
const TIMEOUT_MS = 4_000;
// Unsplash asks for these on every link back to them
const UTM = 'utm_source=tripplanner&utm_medium=referral';
export const UNSPLASH_URL = `https://unsplash.com/?${UTM}`;

const key = () => process.env.UNSPLASH_ACCESS_KEY;
export const coversEnabled = () => !!key();

interface UnsplashPhoto {
  urls?: { raw?: string }
  user?: { name?: string; links?: { html?: string } }
  links?: { download_location?: string }
}

const isUnsplash = (url: unknown, host: string): url is string => {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && u.hostname === host;
  } catch {
    return false;
  }
};

// A portrait photo for "Lisbon" or "Bali, Indonesia", or null when there is none or no key.
// Throws when Unsplash does not answer, so the caller can try again later instead of saving "no photo".
export async function findCover(destination: string): Promise<TripCover | null> {
  const query = destination.trim().slice(0, 100);
  if (!coversEnabled() || !query) return null;
  const headers = { Authorization: `Client-ID ${key()}`, 'Accept-Version': 'v1' };
  const params = new URLSearchParams({ query, orientation: 'portrait', content_filter: 'high', per_page: '1' });
  const res = await fetch(`${API}/search/photos?${params}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const photo = ((await res.json()) as { results?: UnsplashPhoto[] }).results?.[0];
  const raw = photo?.urls?.raw;
  const author = photo?.user?.name?.trim();
  const profile = photo?.user?.links?.html;
  // Only addresses on Unsplash's own servers are kept, since the client shows them as they are
  if (!photo || !isUnsplash(raw, 'images.unsplash.com') || !author || !isUnsplash(profile, 'unsplash.com')) return null;

  // Tell Unsplash the photo is used; the answer is not needed
  const download = photo.links?.download_location;
  if (isUnsplash(download, 'api.unsplash.com')) fetch(download, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {});

  const url = new URL(raw);
  // Sized for a card at most about 300 px wide on a sharp screen, cut to 3:4
  for (const [k, v] of Object.entries({ w: '640', h: '854', fit: 'crop', q: '75', auto: 'format' })) url.searchParams.set(k, v);
  return { url: url.toString(), author: author.slice(0, 80), authorUrl: `${profile}?${UTM}` };
}
